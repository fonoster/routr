/*
 * Copyright (C) 2026 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr.
 *
 * Licensed under the MIT License (the "License");
 * you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 *    https://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Args, Command, Flags } from "@oclif/core"
import { readFileSync } from "fs"
import { dirname, join } from "path"
import { load as parseYaml } from "js-yaml"
import { MessageRequest, Trace } from "@routr/common"
import { pickGlyphs } from "../../trace/glyphs"
import {
  loadTrace,
  profilesFor,
  TraceExit,
  TraceLoadError
} from "../../trace/load"
import { sendToProcessor } from "./send"

export interface CompatFileResult {
  file: string
  records: number
  replayed: boolean
  drifts: Trace.Drift[]
  // Every finding, and the ones the manifest did not declare
  findings: (Trace.Finding & { seq: number })[]
  unexpected: (Trace.Finding & { seq: number })[]
  // Declared findings that no longer fire
  missing: string[]
}

/**
 * Replays every record of every manifest file through a live chain and
 * lints each file. Exported so it can be driven without gRPC in tests.
 *
 * @param {object} params - Manifest, profiles and the sender to use
 * @param {string} params.manifestPath - Path to the manifest
 * @param {Trace.Profile[]} params.profiles - Profiles added to each file's own
 * @param {string} params.against - Address of the dispatcher or processor, if replaying
 * @param {Function} params.send - Sends a request and returns the live answer
 * @return {Promise<CompatFileResult[]>} One result per file, in manifest order
 */
export async function runCompat(params: {
  manifestPath: string
  profiles: Trace.Profile[]
  against?: string
  send: (addr: string, request: MessageRequest) => Promise<MessageRequest>
}): Promise<CompatFileResult[]> {
  const manifest = Trace.parseManifest(
    parseYaml(readFileSync(params.manifestPath, "utf8"))
  )
  const dir = dirname(params.manifestPath)
  const results: CompatFileResult[] = []
  // eslint-disable-next-line no-loops/no-loops
  for (const entry of manifest.files) {
    const loaded = loadTrace(join(dir, entry.file))
    const profiles = Array.from(
      new Set([...entry.profiles, ...params.profiles])
    )
    const findings: (Trace.Finding & { seq: number })[] = []
    Trace.Rules.evaluateAll(loaded.records, { profiles }).forEach((fs, seq) =>
      fs.forEach((f) => findings.push({ seq, ...f }))
    )
    const drifts: Trace.Drift[] = []
    const replayed = !!params.against && entry.replay
    if (replayed) {
      // eslint-disable-next-line no-loops/no-loops
      for (const record of loaded.records) {
        const live = await params.send(params.against, record.request)
        const drift = Trace.compareLive(record, live)
        if (drift) drifts.push(drift)
      }
    }
    const fired = new Set(findings.map((f) => f.rule))
    results.push({
      file: entry.file,
      records: loaded.records.length,
      replayed,
      drifts,
      findings,
      unexpected: findings.filter((f) => !entry.findings.includes(f.rule)),
      missing: entry.findings.filter((rule) => !fired.has(rule))
    })
  }
  return results
}

// eslint-disable-next-line require-jsdoc
export default class CompatCommand extends Command {
  static readonly description =
    "Replays the known-good corpus through a running dispatcher (or processor) and reports every message whose outcome or outgoing headers drifted from the recording, plus the rule findings of each file. The build's compatibility test."

  static readonly examples = [
    "<%= config.bin %> <%= command.id %> etc/corpus/manifest.yaml --against localhost:51901",
    "<%= config.bin %> <%= command.id %> etc/corpus/manifest.yaml --against localhost:51901 --sip-connect --fail-on drift",
    "<%= config.bin %> <%= command.id %> etc/corpus/manifest.yaml  # lint only"
  ]

  static readonly flags = {
    against: Flags.string({
      description:
        "host:port of the dispatcher (51901) or a processor (51904); omit to lint only"
    }),
    "sip-connect": Flags.boolean({
      description: "also evaluate the SIPconnect 1.1 rules on every file",
      default: false
    }),
    "fail-on": Flags.string({
      description:
        "exit 4 on drift (drift), on drift or a new error finding (error), or on drift or any new finding (warning); findings the manifest declares never count",
      options: ["drift", "error", "warning"]
    }),
    json: Flags.boolean({
      description: "print the report as JSON",
      default: false
    }),
    ascii: Flags.boolean({
      description: "draw with ASCII glyphs only",
      default: false
    })
  }

  static args = {
    manifest: Args.string({
      required: true,
      description: "the corpus manifest (etc/corpus/manifest.yaml)"
    })
  }

  // eslint-disable-next-line require-jsdoc
  async run(): Promise<void> {
    const { args, flags } = await this.parse(CompatCommand)
    const g = pickGlyphs(flags.ascii)
    let results: CompatFileResult[]
    try {
      results = await runCompat({
        manifestPath: args.manifest,
        profiles: profilesFor(flags["sip-connect"]),
        against: flags.against,
        send: sendToProcessor
      })
    } catch (e) {
      if (e instanceof TraceLoadError) this.error(e.message, { exit: e.exit })
      this.error((e as Error).message, { exit: TraceExit.USAGE })
    }

    if (flags.json) {
      this.log(JSON.stringify(results, null, 2))
    } else {
      results.forEach((r) => {
        const bad = r.drifts.length || r.unexpected.length || r.missing.length
        const state = bad
          ? `${g.differs} drift`
          : r.replayed
          ? `${g.pass} ok`
          : `${g.pass} lint only`
        const known = r.findings.length - r.unexpected.length
        const lint = r.findings.length
          ? `  ${known} known finding${known === 1 ? "" : "s"}${
              r.unexpected.length ? `, ${r.unexpected.length} new` : ""
            }`
          : ""
        this.log(`${state}  ${r.file}  ${r.records} records${lint}`)
        r.drifts.forEach((d) =>
          this.log(`  ${g.differs} seq ${d.seq}  ${d.reason}`)
        )
        r.unexpected.forEach((f) =>
          this.log(
            `  ${f.severity === Trace.Severity.ERROR ? g.fail : g.warn} seq ${
              f.seq
            }  ${f.rule}  ${f.message}  (not in the manifest)`
          )
        )
        r.missing.forEach((rule) =>
          this.log(
            `  ${g.differs} ${rule} no longer fires; update the manifest`
          )
        )
      })
    }

    const drifted = results.some((r) => r.drifts.length || r.missing.length)
    const errored = results.some((r) =>
      r.unexpected.some((f) => f.severity === Trace.Severity.ERROR)
    )
    const warned = results.some((r) => r.unexpected.length)
    if (
      (flags["fail-on"] === "drift" && drifted) ||
      (flags["fail-on"] === "error" && (drifted || errored)) ||
      (flags["fail-on"] === "warning" && (drifted || warned))
    ) {
      this.exit(TraceExit.FAIL_ON)
    }
  }
}

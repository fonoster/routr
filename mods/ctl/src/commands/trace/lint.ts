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
import { Trace } from "@routr/common"
import { pickGlyphs } from "../../trace/glyphs"
import {
  loadTrace,
  profilesFor,
  TraceExit,
  TraceLoadError
} from "../../trace/load"

// eslint-disable-next-line require-jsdoc
export default class LintCommand extends Command {
  static readonly description =
    "Evaluates the SIP rules on every record of one or more traces and prints each finding with its spec citation. Pass --sip-connect to add the SIPconnect 1.1 rules."

  static readonly examples = [
    "<%= config.bin %> <%= command.id %> call.jsonl",
    "<%= config.bin %> <%= command.id %> traces/*.jsonl --sip-connect --fail-on warning",
    "<%= config.bin %> <%= command.id %> call.jsonl --json"
  ]

  static readonly strict = false

  static readonly flags = {
    "sip-connect": Flags.boolean({
      description: "also evaluate the SIPconnect 1.1 rules",
      default: false
    }),
    "fail-on": Flags.string({
      description: "exit 4 when a finding of this severity or worse exists",
      options: ["error", "warning"]
    }),
    json: Flags.boolean({
      description: "print the findings as JSON",
      default: false
    }),
    ascii: Flags.boolean({
      description: "draw with ASCII glyphs only",
      default: false
    })
  }

  static args = {
    file: Args.string({
      required: true,
      description: "one or more .jsonl traces written by the dispatcher"
    })
  }

  // eslint-disable-next-line require-jsdoc
  async run(): Promise<void> {
    const { argv, flags } = await this.parse(LintCommand)
    const g = pickGlyphs(flags.ascii)
    const profiles = profilesFor(flags["sip-connect"])
    const files = argv as string[]
    const report: {
      file: string
      records: number
      findings: (Trace.Finding & { seq: number })[]
    }[] = []

    files.forEach((file) => {
      try {
        const loaded = loadTrace(file)
        const findings = Trace.Rules.evaluateAll(loaded.records, { profiles })
        const flat: (Trace.Finding & { seq: number })[] = []
        findings.forEach((fs, seq) =>
          fs.forEach((f) => flat.push({ seq, ...f }))
        )
        report.push({
          file: loaded.file,
          records: loaded.records.length,
          findings: flat
        })
      } catch (e) {
        if (e instanceof TraceLoadError) this.error(e.message, { exit: e.exit })
        throw e
      }
    })

    if (flags.json) {
      this.log(JSON.stringify({ profiles, files: report }, null, 2))
    } else {
      report.forEach((r) => {
        const errors = r.findings.filter(
          (f) => f.severity === Trace.Severity.ERROR
        ).length
        const warnings = r.findings.length - errors
        const summary = r.findings.length
          ? `${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${
              warnings === 1 ? "" : "s"
            }`
          : `${g.pass} no findings`
        this.log(`${r.file}  ${r.records} records  ${summary}`)
        r.findings.forEach((f) => {
          const glyph = f.severity === Trace.Severity.ERROR ? g.fail : g.warn
          this.log(
            `  ${glyph} seq ${f.seq}  ${f.rule}  ${f.message}  (${f.spec})`
          )
        })
      })
      this.log(`rules: ${profiles.join(", ")}`)
    }

    const worst = report.flatMap((r) => r.findings)
    if (
      (flags["fail-on"] === "error" &&
        worst.some((f) => f.severity === Trace.Severity.ERROR)) ||
      (flags["fail-on"] === "warning" && worst.length)
    ) {
      this.exit(TraceExit.FAIL_ON)
    }
  }
}

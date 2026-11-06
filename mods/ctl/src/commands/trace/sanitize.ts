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
import { readFileSync, writeFileSync } from "fs"
import { load as parseYaml } from "js-yaml"
import { Trace } from "@routr/common"
import { loadTrace, TraceExit, TraceLoadError } from "../../trace/load"

// eslint-disable-next-line require-jsdoc
export default class SanitizeCommand extends Command {
  static readonly description =
    "Prepares a recording for the known-good corpus: replaces every value that is not protocol structure with a fake that stays the same across the file, then recomputes every digest response with the corpus test credentials (so it still authenticates on replay). Exits 1 and writes nothing when a replaced value is still in the output. Read the output before opening a pull request."

  static readonly examples = [
    "<%= config.bin %> <%= command.id %> call.jsonl --credentials etc/corpus/resources/credentials.yaml --out interop/twilio/zoiper_dod-invite_twilio_20261101.jsonl",
    "<%= config.bin %> <%= command.id %> call.jsonl --credentials creds.yaml --keep-host wa.meta.vc --rewrite +13055550100=+15555550100 --rewrite 203.0.113.7=10.111.220.22"
  ]

  static readonly flags = {
    credentials: Flags.string({
      required: true,
      description:
        "a simpledata credentials.yaml; every digest username, as it reads after the rewrites, must appear in it, and these usernames are kept"
    }),
    "keep-host": Flags.string({
      multiple: true,
      description: "a host or an address to keep as it is; repeatable"
    }),
    rewrite: Flags.string({
      multiple: true,
      description:
        "literal rewrite old=new, applied to every string first: new is the fake of old; repeatable"
    }),
    out: Flags.string({
      description: "where to write the sanitized file (default: stdout)"
    })
  }

  static args = {
    file: Args.string({
      required: true,
      description: "a .jsonl trace written by the dispatcher"
    })
  }

  // eslint-disable-next-line require-jsdoc
  async run(): Promise<void> {
    const { args, flags } = await this.parse(SanitizeCommand)
    const credentials = Trace.credentialsFromResources(
      parseYaml(readFileSync(flags.credentials, "utf8"))
    )
    const rewrites: [string, string][] = (flags.rewrite ?? []).map((r) => {
      const i = r.indexOf("=")
      if (i <= 0) this.error(`--rewrite expects old=new, got ${r}`, { exit: 1 })
      return [r.slice(0, i), r.slice(i + 1)]
    })

    let out: string
    try {
      const loaded = loadTrace(args.file)
      if (loaded.truncatedLines) {
        this.error(`${loaded.file}: last line is truncated`, {
          exit: TraceExit.UNREADABLE
        })
      }
      out =
        Trace.sanitizeTrace(loaded.records, {
          credentials,
          rewrites,
          keepHosts: flags["keep-host"] ?? []
        })
          .map((r) => JSON.stringify(r))
          .join("\n") + "\n"
    } catch (e) {
      if (e instanceof TraceLoadError) this.error(e.message, { exit: e.exit })
      if (e instanceof Trace.UnknownCredentialError) {
        this.error(
          `${e.message}; pass --rewrite ${
            e.recordedUsername ?? e.username
          }=<test username>, with a username from ${
            flags.credentials
          }. Don't add this name there: a listed username stays in the output`,
          { exit: TraceExit.FAIL_ON }
        )
      }
      if (e instanceof Trace.SurvivingValueError) {
        // Not this.error: it wraps and prefixes a line scripts may look for
        this.logToStderr(`sanitize: ${args.file}: ${e.message}`)
        this.exit(1)
      }
      throw e
    }

    if (flags.out) {
      writeFileSync(flags.out, out)
      this.log(`wrote ${flags.out}`)
    } else {
      process.stdout.write(out)
    }
  }
}

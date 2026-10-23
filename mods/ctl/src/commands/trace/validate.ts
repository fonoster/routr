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
import { Args, Command } from "@oclif/core"
import { Trace } from "@routr/common"
import { loadTrace, TraceLoadError } from "../../trace/load"

// eslint-disable-next-line require-jsdoc
export default class ValidateCommand extends Command {
  static readonly description =
    "Checks that every line of a trace is a record this rctl can read: valid JSON, a supported traceVersion, and the record schema."

  static readonly examples = ["<%= config.bin %> <%= command.id %> call.jsonl"]

  static args = {
    file: Args.string({
      required: true,
      description: "a .jsonl trace written by the dispatcher"
    })
  }

  // eslint-disable-next-line require-jsdoc
  async run(): Promise<void> {
    const { args } = await this.parse(ValidateCommand)
    try {
      const loaded = loadTrace(args.file)
      if (loaded.truncatedLines) {
        this.error(
          `${loaded.file}: last line is truncated; ${loaded.records.length} of ${loaded.totalLines} records readable`,
          { exit: 2 }
        )
      }
      const calls = new Set(loaded.records.map((r) => r.callId))
      this.log(
        `${loaded.file}: ${loaded.records.length} records, trace version ${
          Trace.TRACE_VERSION
        }, ${
          calls.size === 1
            ? `Call-ID ${loaded.records[0].callId}`
            : `${calls.size} calls`
        }`
      )
    } catch (e) {
      if (e instanceof TraceLoadError) this.error(e.message, { exit: e.exit })
      throw e
    }
  }
}

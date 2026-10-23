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
import { pickGlyphs } from "../../trace/glyphs"
import {
  loadTrace,
  profilesFor,
  TraceExit,
  TraceLoadError
} from "../../trace/load"
import { analyze, CallModel } from "../../trace/model"
import { VIEWS } from "../../trace/paint"
import { renderStatic, StaticView } from "../../trace/static"
import { runApp } from "../../trace/app"

// eslint-disable-next-line require-jsdoc
export default class ReplayCommand extends Command {
  static readonly description =
    "Replays a recorded call: the ladder of every message, what each component changed, and the rule findings. Pass --sip-connect for the SIPconnect 1.1 rules and --compare to line up two recordings of the same scenario."

  static readonly examples = [
    "<%= config.bin %> <%= command.id %> call.jsonl",
    "<%= config.bin %> <%= command.id %> call.jsonl --compare call-before-upgrade.jsonl",
    "<%= config.bin %> <%= command.id %> call.jsonl --static --view ladder --select 2",
    "<%= config.bin %> <%= command.id %> call.jsonl --static --fail-on rejected"
  ]

  static readonly flags = {
    compare: Flags.string({
      char: "c",
      description: "second trace to line up with the first"
    }),
    static: Flags.boolean({
      char: "s",
      description:
        "print one page and exit; implied when stdout is not a terminal",
      default: false
    }),
    view: Flags.string({
      char: "v",
      description: "view to open or print",
      options: ["summary", "ladder", "path", "compare", "all"],
      default: "summary"
    }),
    select: Flags.integer({
      description:
        "record seq to select; in static mode its hops and diff are printed"
    }),
    columns: Flags.integer({
      description:
        "width of a static page (default: the terminal's, else 100; never above 120)"
    }),
    ascii: Flags.boolean({
      description: "draw with ASCII glyphs only",
      default: false
    }),
    "fail-on": Flags.string({
      description:
        "exit 4 when the call has a rejected message (rejected) or a failed or warned check (warning)",
      options: ["rejected", "warning"]
    }),
    "sip-connect": Flags.boolean({
      description: "also evaluate the SIPconnect 1.1 rules",
      default: false
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
    const { args, flags } = await this.parse(ReplayCommand)
    const g = pickGlyphs(flags.ascii)

    let a: CallModel
    let b: CallModel | undefined
    try {
      const profiles = profilesFor(flags["sip-connect"])
      a = analyze(loadTrace(args.file), { profiles })
      b = flags.compare
        ? analyze(loadTrace(flags.compare), { profiles })
        : undefined
    } catch (e) {
      if (e instanceof TraceLoadError) {
        this.error(e.message, { exit: e.exit })
      }
      throw e
    }

    const isTTY = !!process.stdout.isTTY
    const useStatic = flags.static || !isTTY || flags.view === "all"
    if (useStatic) {
      if (!flags.static && !isTTY) {
        process.stderr.write(
          "stdout is not a terminal; printing the summary page\n"
        )
      }
      const columns =
        flags.columns ?? (isTTY ? process.stdout.columns : 100) ?? 100
      process.stdout.write(
        renderStatic(a, b, {
          view: flags.view as StaticView,
          columns,
          select: flags.select,
          g
        })
      )
      if (flags["fail-on"]) {
        const rejected = a.verdict.word === "REJECTED"
        const warned = a.checks.some(
          (c) => c.state === "fail" || c.state === "warn"
        )
        if (
          (flags["fail-on"] === "rejected" && rejected) ||
          (flags["fail-on"] === "warning" && (rejected || warned))
        ) {
          this.exit(TraceExit.FAIL_ON)
        }
      }
      return
    }

    const view = Math.max(
      0,
      VIEWS.findIndex((v) => v.toLowerCase() === flags.view)
    )
    await runApp(a, b, {
      view: view === 3 && !b ? 0 : view,
      g,
      select: flags.select
    })
  }
}

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
import { readFileSync } from "fs"
import { basename } from "path"
import { Trace } from "@routr/common"

/** Exit codes of the trace commands. */
export enum TraceExit {
  OK = 0,
  USAGE = 1,
  UNREADABLE = 2,
  UNSUPPORTED_VERSION = 3,
  FAIL_ON = 4
}

/** An error the trace commands print on stderr before exiting with a code. */
export class TraceLoadError extends Error {
  readonly exit: TraceExit

  /**
   * @param {string} message - What to print on stderr
   * @param {TraceExit} exit - Process exit code
   */
  constructor(message: string, exit: TraceExit) {
    super(message)
    this.name = "TraceLoadError"
    this.exit = exit
  }
}

export interface LoadedTrace {
  file: string
  path: string
  records: Trace.TraceRecord[]
  // Number of lines that did not parse because the file ends mid-record
  truncatedLines: number
  // Total non-blank lines in the file
  totalLines: number
}

/**
 * Reads a trace file for display. Every record is validated against the
 * schema and the version is checked before anything else. The only
 * leniency: a file whose final line is cut (a recording still being
 * written) loads the records that parse and reports the cut.
 *
 * @param {string} path - Path to the .jsonl file
 * @return {LoadedTrace} The records and what was skipped
 */
export function loadTrace(path: string): LoadedTrace {
  const file = basename(path)
  let text: string
  try {
    text = readFileSync(path, "utf8")
  } catch (e) {
    const reason =
      (e as NodeJS.ErrnoException).code === "ENOENT"
        ? "no such file"
        : (e as Error).message
    throw new TraceLoadError(
      `cannot read ${file}: ${reason}`,
      TraceExit.UNREADABLE
    )
  }

  const lines = text
    .split("\n")
    .map((raw, index) => ({ raw: raw.trim(), line: index + 1 }))
    .filter(({ raw }) => raw.length > 0)

  if (lines.length === 0) {
    throw new TraceLoadError(`${file} has no records`, TraceExit.UNREADABLE)
  }

  const records: Trace.TraceRecord[] = []
  let truncatedLines = 0

  lines.forEach(({ raw, line }, index) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      if (index === lines.length - 1) {
        truncatedLines = 1
        return
      }
      throw new TraceLoadError(
        `${file} line ${line}: invalid JSON`,
        TraceExit.UNREADABLE
      )
    }

    try {
      records.push(Trace.validateRecord(parsed, line))
    } catch (e) {
      if (e instanceof Trace.UnsupportedTraceVersionError) {
        const version = e.version
        const message =
          version === undefined
            ? `${file} is not a Routr trace`
            : `${file} is trace version ${JSON.stringify(version)}; ` +
              `this rctl reads version ${Trace.SUPPORTED_TRACE_VERSIONS.join(
                ", "
              )}. Upgrade rctl`
        throw new TraceLoadError(
          index === 0
            ? message
            : `${file} line ${line}: ${e.message.replace(/^line \d+: /, "")}`,
          TraceExit.UNSUPPORTED_VERSION
        )
      }
      throw new TraceLoadError(
        `${file} ${(e as Error).message}`,
        TraceExit.UNREADABLE
      )
    }
  })

  if (records.length === 0) {
    throw new TraceLoadError(`${file} has no records`, TraceExit.UNREADABLE)
  }

  return { file, path, records, truncatedLines, totalLines: lines.length }
}

/**
 * Rule profiles for the trace commands: sip always, sip-connect on request.
 *
 * @param {boolean} sipConnect - The --sip-connect flag
 * @return {Trace.Profile[]} Profiles to evaluate
 */
export function profilesFor(sipConnect?: boolean): Trace.Profile[] {
  return sipConnect
    ? [Trace.Profile.SIP, Trace.Profile.SIP_CONNECT]
    : [Trace.Profile.SIP]
}

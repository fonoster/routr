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
import { MessageRequest, MessageType } from "../types"
import { diffMessages, isEmptyDiff } from "./diff"
import { normalizeMessage } from "./normalize"
import { statusCodeOf } from "./status"
import { MessageDiff, Profile, TraceOutcome, TraceRecord } from "./types"

/*
 * A known-good corpus: recordings committed to the repository and replayed
 * through the live chain on every change, so a drift in what the chain
 * answers to known traffic fails the build.
 */

/** File name: <origin>_<flow>_<far-end>_<YYYYMMDD>.jsonl */
export const CORPUS_FILE_NAME =
  /^[a-z0-9][a-z0-9-]*_[a-z0-9][a-z0-9.-]*_[a-z0-9][a-z0-9-]*_\d{8}\.jsonl$/

export interface CorpusEntry {
  file: string
  // Rule profiles the file must pass; "sip" is implied
  profiles: Profile[]
  // Replay through the live chain (default true); false keeps it lint-only
  replay: boolean
  // Rule ids the recording is known to trip (the traffic or the lab topology
  // is what it is); any other finding is a regression, a missing one a change
  findings: string[]
  note?: string
}

export interface CorpusManifest {
  // Directory with the simpledata resources the compat chain loads
  resources: string
  files: CorpusEntry[]
}

/**
 * Validates a parsed manifest (YAML or JSON) and fills the defaults.
 *
 * @param {unknown} input - The parsed manifest
 * @return {CorpusManifest} A complete manifest
 */
export function parseManifest(input: unknown): CorpusManifest {
  const m = input as { resources?: unknown; files?: unknown }
  if (!m || typeof m !== "object") throw new Error("manifest is not an object")
  if (typeof m.resources !== "string" || !m.resources) {
    throw new Error("manifest needs a resources directory")
  }
  if (!Array.isArray(m.files)) throw new Error("manifest needs a files list")
  const files = m.files.map((raw, i) => {
    const e = raw as Partial<CorpusEntry>
    if (!e || typeof e.file !== "string") {
      throw new Error(`files[${i}] has no file name`)
    }
    if (!CORPUS_FILE_NAME.test(e.file)) {
      throw new Error(
        `${e.file} does not follow <origin>_<flow>_<far-end>_<YYYYMMDD>.jsonl`
      )
    }
    const profiles = Array.from(
      new Set<Profile>([Profile.SIP, ...((e.profiles as Profile[]) ?? [])])
    )
    profiles.forEach((p) => {
      if (!Object.values(Profile).includes(p)) {
        throw new Error(`${e.file}: unknown profile ${p}`)
      }
    })
    const findings = (e.findings as string[]) ?? []
    if (
      !Array.isArray(findings) ||
      findings.some((f) => typeof f !== "string")
    ) {
      throw new Error(`${e.file}: findings must be a list of rule ids`)
    }
    return {
      file: e.file,
      profiles,
      replay: e.replay !== false,
      findings: Array.from(new Set(findings)).sort(),
      ...(e.note ? { note: e.note } : {})
    }
  })
  return { resources: m.resources, files }
}

export interface Drift {
  seq: number
  // What changed, in one line
  reason: string
  diff?: MessageDiff
}

const outcomeOf = (
  live: MessageRequest
): { outcome: TraceOutcome; status?: number } => {
  const isResponse = live.message?.messageType === MessageType.RESPONSE
  const status = isResponse
    ? statusCodeOf(live.message.responseType)
    : undefined
  return isResponse
    ? {
        outcome:
          status !== undefined && status < 300
            ? TraceOutcome.ANSWERED
            : TraceOutcome.REJECTED,
        status
      }
    : { outcome: TraceOutcome.FORWARDED }
}

/**
 * Compares what the live chain answered with what the recording holds,
 * after normalizing the values that differ between runs. Timing never
 * counts.
 *
 * @param {TraceRecord} record - The recorded message
 * @param {MessageRequest} live - What the chain returned for record.request
 * @return {Drift | undefined} The drift, or undefined when they agree
 */
export function compareLive(
  record: TraceRecord,
  live: MessageRequest
): Drift | undefined {
  const recordedIsResponse =
    record.request.message.messageType === MessageType.RESPONSE
  if (!recordedIsResponse) {
    const got = outcomeOf(live)
    if (
      got.outcome !== record.outcome ||
      (record.status ?? got.status) !== got.status
    ) {
      return {
        seq: record.seq,
        reason: `recorded ${record.outcome}${
          record.status ? " " + record.status : ""
        }, live ${got.outcome}${got.status ? " " + got.status : ""}`
      }
    }
  }
  if (!record.response?.message || !live.message) {
    return record.response?.message || live.message
      ? { seq: record.seq, reason: "one side has no outgoing message" }
      : undefined
  }
  const diff = diffMessages(
    normalizeMessage(record.response.message),
    normalizeMessage(live.message)
  )
  if (isEmptyDiff(diff)) return undefined
  const changed = [
    ...(diff.requestUri ? ["Request-URI"] : []),
    ...Object.keys(diff.headers.changed),
    ...Object.keys(diff.headers.added).map((h) => "+" + h),
    ...Object.keys(diff.headers.removed).map((h) => "-" + h)
  ]
  return {
    seq: record.seq,
    reason: `outgoing message differs: ${changed.join(", ")}`,
    diff
  }
}

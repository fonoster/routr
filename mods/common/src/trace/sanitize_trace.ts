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
import { z } from "zod/v4"
import { ValidationError } from "../validation_error"
import {
  createScrubber,
  MIN_SEARCHED_LENGTH,
  Scrubber
} from "./create_scrubber"
import { applyRewrites, Credential, recomputeDigests } from "./sanitize"
import { scrubBody } from "./scrub_sdp"
import { TraceRecord } from "./types"

export interface SanitizeTraceOptions {
  // Test credentials the digest responses are recomputed with. Their usernames
  // are test values, so they stay
  credentials: Credential[]
  // from/to pairs: "to" is the fake of "from"
  rewrites?: [string, string][]
  // Hosts and addresses that stay as they are
  keepHosts?: string[]
}

const sanitizeTraceSchema = z.object({
  credentials: z.array(
    z.object({ username: z.string(), password: z.string() })
  ),
  rewrites: z.array(z.tuple([z.string(), z.string()])).optional(),
  keepHosts: z.array(z.string()).optional()
})

/**
 * Thrown when a value that was replaced is still somewhere in the output. It
 * names where, and never the value, since this message ends up in a terminal
 * or a CI log.
 */
export class SurvivingValueError extends Error {
  readonly seq: number
  readonly field: string

  /**
   * @param {number} seq - The record it is on
   * @param {string} field - The path of the string that holds it
   */
  constructor(seq: number, field: string) {
    super(`seq ${seq} ${field} still holds an input value`)
    this.name = "SurvivingValueError"
    this.seq = seq
    this.field = field
  }
}

// Fields that describe the protocol or the recording, not the call's parties
const KEPT_FIELDS = new Set([
  "recordedAt",
  "kind",
  "method",
  "outcome",
  "action",
  "version",
  "edgePortVersion",
  "component",
  "transport",
  "transportParam",
  "methodParam",
  "userParam",
  "messageType",
  "responseType",
  "reasonPhrase",
  "scheme",
  "algorithm",
  "qop",
  "rule",
  "profile",
  "profiles",
  "severity",
  "spec",
  "side",
  "header"
])

// Headers that describe the protocol, lowercase. Every other header's value is
// replaced
const KEPT_HEADERS = new Set([
  "accept",
  "accept-encoding",
  "accept-language",
  "allow",
  "allow-events",
  "content-disposition",
  "content-encoding",
  "content-length",
  "content-type",
  "cseq",
  "event",
  "expires",
  "max-breadth",
  "max-forwards",
  "mime-version",
  "min-expires",
  "min-se",
  "privacy",
  "proxy-require",
  "rack",
  "require",
  "retry-after",
  "rseq",
  "server",
  "session-expires",
  "subscription-state",
  "supported",
  "unsupported",
  "user-agent"
])

const ADDRESS_VALUE = /(?:^|<)(?:sips?|tel):|^SIP\/2\.0\/|^Digest /

const scrubHeader = (name: string, value: string, s: Scrubber): string => {
  const lower = name.toLowerCase()
  if (KEPT_HEADERS.has(lower)) return value
  if (lower === "body") return scrubBody(value, s)
  return ADDRESS_VALUE.test(value) ? s.text(value) : s.opaque(value)
}

// How to replace the string held by each field; any other field is one value
const fieldScrubbers = (
  s: Scrubber
): Record<string, (value: string) => string> => ({
  host: s.host,
  received: s.host,
  mAddr: s.host,
  mAddrParam: s.host,
  realm: s.host,
  domain: s.host,
  externalAddrs: s.host,
  localnets: s.host,
  aliases: s.host,
  user: s.user,
  username: s.user,
  displayName: s.name,
  branch: s.branch,
  rfo: s.identity,
  rfn: s.identity,
  rco: s.identity,
  rcn: s.identity,
  uri: s.text,
  from: s.text,
  to: s.text,
  error: s.text,
  message: s.text,
  body: (value) => scrubBody(value, s)
})

const scrubHeaders = (
  headers: Record<string, string>,
  s: Scrubber
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      scrubHeader(name, value, s)
    ])
  )

/**
 * Replaces every string of a part of a record that is not protocol structure.
 *
 * @param {unknown} value - The part
 * @param {string} field - The field that holds it
 * @param {Scrubber} s - The file's value replacer
 * @return {unknown} A copy with its strings replaced
 */
function scrubValue(value: unknown, field: string, s: Scrubber): unknown {
  if (Array.isArray(value)) {
    if (field === "extensions") {
      return value.map((e) => ({
        ...e,
        value: scrubHeader(e.name, e.value, s)
      }))
    }
    return value.map((v) => scrubValue(v, field, s))
  }
  if (value && typeof value === "object") {
    if (field === "added" || field === "removed") {
      return scrubHeaders(value as Record<string, string>, s)
    }
    if (field === "changed") {
      return Object.fromEntries(
        Object.entries(value as Record<string, Record<string, string>>).map(
          ([name, change]) => [
            name,
            {
              from: scrubHeader(name, change.from, s),
              to: scrubHeader(name, change.to, s)
            }
          ]
        )
      )
    }
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, scrubValue(v, k, s)])
    )
  }
  if (typeof value !== "string" || KEPT_FIELDS.has(field)) return value
  return (fieldScrubbers(s)[field] ?? s.opaque)(value)
}

/**
 * Lists every string of a record with its path. Header names are left out: they
 * are protocol, and a name like "Agent" would match User-Agent.
 *
 * @param {unknown} value - A part of the record
 * @param {string} path - Its path
 * @param {string} parent - The field that holds it
 * @return {Array<[string, string]>} path and string pairs
 */
function stringsOf(
  value: unknown,
  path: string,
  parent: string
): [string, string][] {
  if (typeof value === "string") return [[path, value]]
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => stringsOf(v, `${path}[${i}]`, parent))
  }
  if (!value || typeof value !== "object") return []
  const headerNames = ["added", "removed", "changed"].includes(parent)
  return Object.entries(value).flatMap(([k, v]) => {
    if (parent === "extensions" && k === "name") return []
    const keyString: [string, string][] = headerNames ? [] : [[path, k]]
    return keyString.concat(stringsOf(v, path ? `${path}.${k}` : k, k))
  })
}

/**
 * Sanitizes a whole file for the public corpus. Every value that is not protocol
 * structure, or chosen with a rewrite or keepHosts, gets a fake that stays the
 * same across the file, so dialogs stay consistent. Digest responses are then
 * recomputed over the fakes. A value of 5 or more characters found afterwards
 * in any string, for example in a kept header, fails the whole file.
 *
 * @param {TraceRecord[]} records - The records of one file
 * @param {SanitizeTraceOptions} options - Credentials, rewrites and hosts to keep
 * @return {TraceRecord[]} Sanitized copies
 * @throws {ValidationError} When the options are invalid
 * @throws {UnknownCredentialError} When a digest username has no credential
 * @throws {SurvivingValueError} When a replaced value is still in the output
 */
export function sanitizeTrace(
  records: TraceRecord[],
  options: SanitizeTraceOptions
): TraceRecord[] {
  const parsed = sanitizeTraceSchema.safeParse(options)
  if (!parsed.success) throw new ValidationError(parsed.error)
  const credentials = parsed.data.credentials as Credential[]
  const rewrites = (parsed.data.rewrites ?? []) as [string, string][]

  const scrubber = createScrubber({
    pinned: [
      ...credentials.map((c) => c.username),
      ...rewrites.map(([, to]) => to)
    ],
    keepHosts: parsed.data.keepHosts ?? []
  })
  const rewritten = records.map((r) =>
    applyRewrites(JSON.parse(JSON.stringify(r)), rewrites)
  )
  const scrub = (r: TraceRecord) => scrubValue(r, "", scrubber) as TraceRecord

  // The first run only learns the originals; no fake may equal one of them
  rewritten.forEach(scrub)
  scrubber.seal()
  const out = rewritten
    .map(scrub)
    .map((copy, i) => recomputeDigests(copy, records[i], credentials))

  assertNoSurvivors(
    out,
    [
      ...scrubber.originals(),
      ...rewrites.filter(([from, to]) => from !== to).map(([from]) => from)
    ],
    [...scrubber.fakes(), ...rewrites.map(([, to]) => to)]
  )
  return out
}

/**
 * Fails on the first string that still holds an original. Fakes are taken out
 * first: an original may be part of a fake without being in the output
 * (10.0.0.1 and the fake 10.0.0.12).
 *
 * @param {TraceRecord[]} records - The output
 * @param {string[]} originals - The values replaced
 * @param {string[]} fakes - The values handed out
 */
function assertNoSurvivors(
  records: TraceRecord[],
  originals: string[],
  fakes: string[]
): void {
  const searched = originals.filter((v) => v.length >= MIN_SEARCHED_LENGTH)
  const byLength = [...fakes].sort((a, b) => b.length - a.length)
  records.forEach((record) => {
    stringsOf(record, "", "").forEach(([path, value]) => {
      const masked = byLength.reduce(
        (acc, fake) => acc.split(fake).join("\0"),
        value
      )
      if (searched.some((original) => masked.includes(original))) {
        throw new SurvivingValueError(record.seq, path)
      }
    })
  })
}

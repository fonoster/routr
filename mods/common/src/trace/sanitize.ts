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
import { IDENTITY_PARAMETER_NAMES } from "../identity"
import { calculateAuthResponse } from "../auth"
import { AuthChallengeResponse, Method } from "../types"
import { TraceRecord } from "./types"

export interface Credential {
  username: string
  password: string
}

export interface SanitizeOptions {
  // Test credentials the digest responses are recomputed with
  credentials: Credential[]
  // Literal rewrites applied to every string of the record, in order
  rewrites?: [string, string][]
}

/**
 * Thrown when a record carries an Authorization whose username has no
 * test credential: the file would not replay.
 */
export class UnknownCredentialError extends Error {
  readonly username: string
  readonly recordedUsername?: string

  /**
   * @param {string} username - The digest username without a credential, as it
   *   reads after the rewrites (the one looked up)
   * @param {number} seq - The record it appears on
   * @param {string} recordedUsername - The username as recorded, when a rewrite
   *   changed it
   */
  constructor(username: string, seq: number, recordedUsername?: string) {
    const recorded =
      recordedUsername && recordedUsername !== username
        ? ` (recorded as "${recordedUsername}")`
        : ""
    super(
      `record ${seq}: no credential for digest username "${username}"${recorded}`
    )
    this.name = "UnknownCredentialError"
    this.username = username
    if (recorded) this.recordedUsername = recordedUsername
  }
}

/**
 * Makes a recording committable as a known-good. First each rewrite is applied
 * to every string, so numbers, hosts and addresses stay consistent across the
 * file. Then every digest response is recomputed with the test password for its
 * username, as that username reads after the rewrites (the digest is stateless,
 * so the record keeps authenticating on replay).
 *
 * @param {TraceRecord} record - A record, redacted or not
 * @param {SanitizeOptions} options - Credentials and rewrites
 * @return {TraceRecord} A sanitized copy
 */
export function sanitizeRecord(
  record: TraceRecord,
  options: SanitizeOptions
): TraceRecord {
  // Rewrite first: a digest covers the URI it was computed for, and a rewrite
  // can change that URI (the number in sip:+<E.164>@...). Recomputing after
  // the rewrite keeps the record authenticating on replay.
  const copy = applyRewrites(
    JSON.parse(JSON.stringify(record)),
    options.rewrites ?? []
  )
  const recorded = [record.request.message, record.response?.message]
  const messages = [copy.request.message, copy.response?.message]
  messages.forEach((m, i) => {
    const auth = m?.authorization
    if (!auth?.username) return
    const cred = options.credentials.find((c) => c.username === auth.username)
    if (!cred) {
      throw new UnknownCredentialError(
        auth.username,
        record.seq,
        recorded[i]?.authorization?.username
      )
    }
    // The recorder writes an empty method on the digest; the record's own
    // method is the one the digest covers (RFC 2617 A2 = method:uri)
    const method = (auth.method || copy.method) as Method
    auth.response = calculateAuthResponse(
      { ...(auth as unknown as AuthChallengeResponse), method },
      { username: cred.username, secret: cred.password }
    )
  })
  return copy
}

/**
 * Applies the literal rewrites to every string of a record, including inside
 * Routr's base64url identity parameters.
 *
 * @param {TraceRecord} record - The record to rewrite
 * @param {Array<[string, string]>} rewrites - from/to pairs, applied in order
 * @return {TraceRecord} The rewritten record
 */
function applyRewrites(
  record: TraceRecord,
  rewrites: [string, string][]
): TraceRecord {
  if (!rewrites.length) return record
  const rewrite = (value: string) =>
    rewrites.reduce((acc, [from, to]) => acc.split(from).join(to), value)
  const text = JSON.stringify(rewriteEncodedIdentities(record, rewrite))
  // The same parameters also travel inside header lines kept as text
  // (";rfo=...;rfn=..." in a hop's diff); base64url has no quote, so they are
  // safe to match in the JSON text
  const encodedInText = new RegExp(
    `\\b(${ENCODED_IDENTITY_PARAMETERS.join("|")})=([A-Za-z0-9_-]+)`,
    "g"
  )
  return JSON.parse(
    rewrite(
      text.replace(
        encodedInText,
        (_m, name: string, value: string) =>
          `${name}=${reencode(value, rewrite)}`
      )
    )
  )
}

/**
 * Decodes a base64url identity parameter, rewrites it and encodes it again.
 *
 * @param {string} value - The base64url value
 * @param {Function} rewrite - The literal rewrites
 * @return {string} The rewritten value, base64url
 */
function reencode(value: string, rewrite: (s: string) => string): string {
  const decoded = Buffer.from(value, "base64url").toString("utf8")
  const rewritten = rewrite(decoded)
  // Untouched unless a rewrite applied: decoding a value that is not UTF-8 text
  // (a parameter with the same name that is not Routr's) would otherwise alter it
  return rewritten === decoded
    ? value
    : Buffer.from(rewritten, "utf8").toString("base64url")
}

// Record-Route parameters in which Routr keeps the caller identity it rewrote
// toward a Trunk, as base64url (see the processor's identity alterations). A
// literal rewrite cannot see inside them, so the real number and host would
// survive sanitizing; they are decoded, rewritten and encoded again.
const ENCODED_IDENTITY_PARAMETERS = IDENTITY_PARAMETER_NAMES

/**
 * Rewrites the identity parameters wherever they are a field of the record.
 *
 * @param {T} value - Any part of the record
 * @param {Function} rewrite - The literal rewrites
 * @return {T} A copy with those parameters rewritten
 */
function rewriteEncodedIdentities<T>(
  value: T,
  rewrite: (s: string) => string
): T {
  if (Array.isArray(value)) {
    return value.map((v) =>
      rewriteEncodedIdentities(v, rewrite)
    ) as unknown as T
  }
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => {
      if (ENCODED_IDENTITY_PARAMETERS.includes(k) && typeof v === "string") {
        return [k, reencode(v, rewrite)]
      }
      return [k, rewriteEncodedIdentities(v, rewrite)]
    })
  ) as T
}

/**
 * Reads credentials out of a simpledata credentials.yaml already parsed.
 *
 * @param {unknown} parsed - The parsed YAML (a list of Credentials resources)
 * @return {Credential[]} username and password pairs
 */
export function credentialsFromResources(parsed: unknown): Credential[] {
  if (!Array.isArray(parsed)) return []
  return parsed
    .map(
      (r) => (r as { spec?: { credentials?: Credential } })?.spec?.credentials
    )
    .filter((c): c is Credential => !!c?.username && !!c?.password)
}

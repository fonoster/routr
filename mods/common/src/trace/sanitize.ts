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

  /**
   * @param {string} username - The digest username without a credential
   * @param {number} seq - The record it appears on
   */
  constructor(username: string, seq: number) {
    super(`record ${seq}: no credential for digest username "${username}"`)
    this.name = "UnknownCredentialError"
    this.username = username
  }
}

/**
 * Makes a recording committable as a known-good: every digest response is
 * recomputed with the test password for its username (the digest is
 * stateless, so the record keeps authenticating), then each rewrite is
 * applied to every string so numbers, hosts and addresses stay consistent
 * across the file.
 *
 * @param {TraceRecord} record - A record, redacted or not
 * @param {SanitizeOptions} options - Credentials and rewrites
 * @return {TraceRecord} A sanitized copy
 */
export function sanitizeRecord(
  record: TraceRecord,
  options: SanitizeOptions
): TraceRecord {
  const copy: TraceRecord = JSON.parse(JSON.stringify(record))
  const messages = [copy.request.message, copy.response?.message].filter(
    Boolean
  )
  messages.forEach((m) => {
    const auth = m.authorization
    if (!auth?.username) return
    const cred = options.credentials.find((c) => c.username === auth.username)
    if (!cred) throw new UnknownCredentialError(auth.username, record.seq)
    const method = (auth.method ?? copy.method) as Method
    auth.response = calculateAuthResponse(
      { ...(auth as unknown as AuthChallengeResponse), method },
      { username: cred.username, secret: cred.password }
    )
  })
  const rewrites = options.rewrites ?? []
  if (!rewrites.length) return copy
  const text = rewrites.reduce(
    (acc, [from, to]) => acc.split(from).join(to),
    JSON.stringify(copy)
  )
  return JSON.parse(text)
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

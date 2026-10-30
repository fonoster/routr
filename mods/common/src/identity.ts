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
import { SipURI } from "./types"

/**
 * The caller identity Routr rewrites toward a Trunk travels in its own
 * Record-Route, as parameters or in the URI user part, so the dialog's later
 * requests can be mapped back without state. Shared by the processor, which
 * writes and reads them, and the trace sanitizer, which must rewrite inside them.
 */

/**
 * The Record-Route parameter names: [r]ewritten [f]rom or [c]allee (To),
 * [o]riginal/[n]ew. Not "rto": a parser that looks for a header by searching for
 * its name (SIPp does) finds "To" inside "rto=" on the Record-Route line.
 */
export const IDENTITY_PARAMETERS = {
  fromOriginal: "rfo",
  fromNew: "rfn",
  toOriginal: "rco",
  toNew: "rcn"
} as const

/** Every identity parameter name, in the order above. */
export const IDENTITY_PARAMETER_NAMES: string[] =
  Object.values(IDENTITY_PARAMETERS)

/** The identity a SIP URI carries, as stored in a Record-Route parameter. */
export interface Identity {
  user?: string
  host: string
  port?: number
  userParam?: string
}

/**
 * Encodes an identity as base64url, which keeps it a SIP token (RFC 3261
 * section 25.1): no quoting in the header, and it survives every hop unchanged.
 *
 * @param {SipURI} uri - The URI whose user, host and user parameter to encode
 * @return {string} The base64url value
 */
export const encodeIdentity = (uri: SipURI): string =>
  Buffer.from(
    `${uri.user ?? ""}@${uri.host}${
      uri.userParam ? `;user=${uri.userParam}` : ""
    }`
  ).toString("base64url")

/**
 * Decodes an identity parameter value, user@host[:port][;user=...].
 *
 * @param {string} value - The base64url value
 * @return {Identity | undefined} The identity, or undefined when it is not one
 */
export const decodeIdentity = (value?: string): Identity | undefined => {
  if (!value) return undefined
  const decoded = Buffer.from(value, "base64url").toString("utf8")
  const [address, userParam] = decoded.split(";user=")
  const at = address.lastIndexOf("@")
  if (at < 0) return undefined
  const user = address.slice(0, at)
  const hostPort = address.slice(at + 1)
  // An IPv6 host keeps its brackets, so its port follows the last "]:"
  const [, host = hostPort, port] =
    hostPort.match(/^(\[[^\]]*\]|[^:]*)(?::(\d+))?$/) ?? []
  return {
    user: user || undefined,
    host,
    ...(port ? { port: Number(port) } : {}),
    userParam: userParam || undefined
  }
}

/**
 * Reads the identity mapping from a Route URI user part of the form
 * rfo.<b64>.rfn.<b64>.rco.<b64>.rcn.<b64>: each pair optional, in that order.
 * The URI is what a user agent keeps of a Record-Route entry (RFC 3261 section
 * 12.1.2), and "." is not in the base64url alphabet.
 *
 * @param {string} user - The URI user part
 * @return {Record<string, string> | undefined} The base64url values by
 * parameter name, or undefined when the user part is not of this form
 */
export const decodeIdentityUser = (
  user?: string
): Record<string, string> | undefined => {
  const parts = (user ?? "").split(".")
  if (parts.length < 2 || parts.length % 2) return undefined
  const pairs = parts
    .filter((_, i) => i % 2 === 0)
    .map((name, i) => [name, parts[i * 2 + 1]])
  const order = pairs.map(([name]) => IDENTITY_PARAMETER_NAMES.indexOf(name))
  const valid =
    order.every((o, i) => o >= 0 && (i === 0 || o > order[i - 1])) &&
    pairs.every(([, value]) => /^[A-Za-z0-9_-]+$/.test(value))
  return valid ? Object.fromEntries(pairs) : undefined
}

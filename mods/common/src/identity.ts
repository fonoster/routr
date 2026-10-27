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
 * Record-Route as parameters, so the dialog's later requests can be mapped back
 * without state. Shared by the processor, which writes and reads them, and the
 * trace sanitizer, which must rewrite inside them.
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
 * Decodes an identity parameter value.
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
  return {
    user: user || undefined,
    host: address.slice(at + 1),
    userParam: userParam || undefined
  }
}

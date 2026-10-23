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
import { assertOnlyOneEnvIsSet } from "./assertions"

assertOnlyOneEnvIsSet(["CONNECT_VERIFIER_ADDR", "CONNECT_VERIFIER_PUBLIC_KEY"])

/**
 * Parses an optional environment variable that must hold a positive integer.
 *
 * @param {string} name - The variable name, used in the error message
 * @param {string} value - The raw value
 * @return {number | undefined} the parsed value, or undefined when unset
 */
function parsePositiveInt(name: string, value?: string): number | undefined {
  if (value === undefined || value.trim() === "") return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got "${value}"`)
  }
  return parsed
}

export const BIND_ADDR = process.env.BIND_ADDR ?? "0.0.0.0:51904"
export const LOCATION_ADDR = process.env.LOCATION_ADDR
export const API_ADDR = process.env.API_ADDR
export const CONNECT_VERIFIER_ADDR = process.env.CONNECT_VERIFIER_ADDR
export const CONNECT_VERIFIER_PUBLIC_KEY_PATH =
  process.env.CONNECT_VERIFIER_PUBLIC_KEY_PATH
export const CONNECT_VERIFIER_OPTIONS = process.env.CONNECT_VERIFIER_OPTIONS
  ? JSON.parse(process.env.CONNECT_VERIFIER_OPTIONS)
  : { expiresIn: "1h", algorithm: ["RS256"] }

// Expiry, in seconds, granted to a REGISTER that carries neither a Contact
// expires parameter nor an Expires header (RFC 3261 section 10.3, step 7).
// Unset leaves the processor's default in place.
export const REGISTER_DEFAULT_EXPIRES = parsePositiveInt(
  "REGISTER_DEFAULT_EXPIRES",
  process.env.REGISTER_DEFAULT_EXPIRES
)

// Platform headers a caller must never be able to set. They are removed from
// requests that come from untrusted sources (e.g., the PSTN or a client using a
// Connect Token) before Routr adds its own. Override with a comma-separated list;
// set it to an empty string to disable stripping.
export const DEFAULT_UNTRUSTED_HEADERS_TO_STRIP = [
  "X-App-Ref",
  "X-Call-Ref",
  "X-Call-Direction",
  "X-DOD-Number",
  "X-DOD-Privacy",
  "X-Access-Key-Id",
  "X-Is-Api-Originated-Type",
  "X-Edgeport-Ref",
  "X-Gateway-Auth",
  "X-Request-Uri",
  "X-Session-Count"
]

export const UNTRUSTED_HEADERS_TO_STRIP =
  process.env.UNTRUSTED_HEADERS_TO_STRIP !== undefined
    ? process.env.UNTRUSTED_HEADERS_TO_STRIP.split(",")
        .map((h) => h.trim())
        .filter((h) => h.length > 0)
    : DEFAULT_UNTRUSTED_HEADERS_TO_STRIP

const parseList = (value?: string): string[] =>
  (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0)

// Peer EdgePorts allowed to forward requests with X-Edgeport-Ref. Such a request
// skips routing and access checks (its route is rebuilt from the message), so it
// is only honored when the packet comes from an address in
// TRUSTED_EDGEPORT_ADDRESSES (IPs or CIDRs, matched against the top Via's
// "received" value, or its host when "received" is absent). TRUSTED_EDGEPORTS
// optionally narrows which X-Edgeport-Ref values are accepted. The defaults trust
// no peer EdgePort, which is right for single-EdgePort deployments: the header is
// removed and the request is routed normally.
export const TRUSTED_EDGEPORTS = parseList(process.env.TRUSTED_EDGEPORTS)
export const TRUSTED_EDGEPORT_ADDRESSES = parseList(
  process.env.TRUSTED_EDGEPORT_ADDRESSES
)

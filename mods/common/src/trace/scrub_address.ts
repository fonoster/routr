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
import { Scrubber } from "./create_scrubber"

const NUMERIC = /^-?[\d.]*$/
const FLAG = /^(?:on|true)?$/i
const oneOf = (...words: string[]) =>
  new RegExp(`^(?:${words.join("|")})$`, "i")

// The parameters of an address that describe the protocol, lowercase, and what
// they can hold. Any other value is replaced, whatever the parameter
const PROTOCOL_VALUES: Record<string, RegExp> = {
  alias: FLAG,
  counter: NUMERIC,
  expires: NUMERIC,
  "id-type": oneOf("subscriber", "user", "alias", "return", "term"),
  keep: NUMERIC,
  limit: NUMERIC,
  lr: FLAG,
  method: oneOf(
    "ACK",
    "BYE",
    "CANCEL",
    "INFO",
    "INVITE",
    "MESSAGE",
    "NOTIFY",
    "OPTIONS",
    "PRACK",
    "PUBLISH",
    "REFER",
    "REGISTER",
    "SUBSCRIBE",
    "UPDATE"
  ),
  ob: FLAG,
  party: oneOf("calling", "called"),
  privacy: oneOf("off", "full", "name", "uri", "ipaddr"),
  q: NUMERIC,
  r2: FLAG,
  reason: oneOf(
    "away",
    "busy",
    "deflection",
    "do-not-disturb",
    "follow-me",
    "no-answer",
    "out-of-service",
    "time-of-day",
    "unavailable",
    "unconditional",
    "unknown",
    "user-busy"
  ),
  "reg-id": NUMERIC,
  rport: NUMERIC,
  screen: oneOf("yes", "no"),
  transport: oneOf("udp", "tcp", "tls", "sctp", "ws", "wss"),
  ttl: NUMERIC,
  user: oneOf("phone", "ip", "dialstring")
}

const DIGEST_PROTOCOL = new Set(["algorithm", "nc", "qop", "stale"])
// The text recognizers replace these when their value is quoted
const DIGEST_RECOGNIZED = new Set([
  "cnonce",
  "nonce",
  "opaque",
  "realm",
  "response",
  "uri",
  "username"
])

const QUOTE = "\x22"
const QUOTED = "\\x22(?:[^\\x22\\\\]|\\\\.)*\\x22"
const PARAMETER = new RegExp(
  `;\\s*([^\\s;=,<>"?]+)(?:\\s*=\\s*(${QUOTED}|[^;,\\s>"?]+))?`,
  "g"
)
const URI_HEADERS = /\?([^>\s"]+)/g
const LIST_ITEM = new RegExp(`(?:${QUOTED}|<[^>]*>|[^,])+`, "g")
const DIGEST_PARAMETER = new RegExp(
  `^\\s*([\\w-]+)\\s*=\\s*(${QUOTED}|[^\\s,"]+)\\s*$`
)

// What an address looks like once its parts are replaced. What doesn't fit, or
// comes after it, was not recognized, so it can still be anything
const PARAMETERS = `(?:;[^\\s;=,<>"?]+(?:=(?:${QUOTED}|[^;,\\s>"?]+))?)*`
const URI =
  "(?:sips?:(?:[^@\\s<>\\x22,]+@)?(?:\\[[^\\]]+\\]|[^\\s;:,<>\\x22?]+)(?::\\d+)?" +
  `|tel:[^\\s;,<>"?]+)${PARAMETERS}(?:\\?[^\\s<>"]*)?`
const ADDRESS = new RegExp(
  `^\\s*(?:(?:${QUOTED}\\s*|[^"<>,;=]*)<${URI}>|${URI}` +
    `|SIP/2\\.0/\\w+ (?:\\[[^\\]]+\\]|[^\\s:;,]+)(?::\\d+)?)${PARAMETERS}`
)

// A header value can hold several, split at the commas outside quotes and <>
const listItems = (value: string): string[] => value.match(LIST_ITEM) ?? []

/**
 * Replaces one parameter of an address, or of an identity parameter's value.
 * A protocol parameter keeps a protocol value, and a flag stays only when it
 * is a protocol one.
 *
 * @param {string} name - The parameter's name
 * @param {string | undefined} value - Its value, quoted if it was, if it has one
 * @param {Scrubber} s - The file's value replacer
 * @return {string} The parameter, as name=value or as a flag
 */
export function scrubParameter(
  name: string,
  value: string | undefined,
  s: Scrubber
): string {
  const lower = name.toLowerCase()
  const allowed = PROTOCOL_VALUES[lower]
  if (value === undefined) {
    const isFlag = allowed?.test("") || lower === "tag" || lower === "branch"
    return isFlag ? name : s.opaque(name)
  }
  if (lower === "branch") return `${name}=${s.branch(value)}`
  if (lower === "received" || lower === "maddr") {
    return `${name}=${s.host(value)}`
  }
  if (IDENTITY_PARAMETER_NAMES.includes(lower)) {
    return `${name}=${s.identity(value)}`
  }
  if (allowed?.test(value)) return `${name}=${value}`
  return value.startsWith(QUOTE)
    ? `${name}="${s.opaque(value.slice(1, -1))}"`
    : `${name}=${s.opaque(value)}`
}

/**
 * Replaces a value that starts like a digest header. Only the digest's own
 * parameters survive: anything else in it is a value.
 *
 * @param {string} value - The value, after "Digest "
 * @param {Scrubber} s - The file's value replacer
 * @return {string} The value
 */
function scrubDigest(value: string, s: Scrubber): string {
  return listItems(s.text(value))
    .map((item) => {
      const [, name, raw] = item.match(DIGEST_PARAMETER) ?? []
      if (!name) return s.opaque(item.trim())
      const lower = name.toLowerCase()
      const quoted = raw.startsWith(QUOTE)
      if (
        DIGEST_PROTOCOL.has(lower) ||
        (quoted && DIGEST_RECOGNIZED.has(lower))
      )
        return item
      return quoted
        ? ` ${name}="${s.opaque(raw.slice(1, -1))}"`
        : ` ${name}=${s.opaque(raw)}`
    })
    .join(",")
}

/**
 * Replaces an address header's value, a URI or a Via: its parts by what they
 * are, its parameters and URI headers, and any text left over.
 *
 * @param {string} value - The value
 * @param {Scrubber} s - The file's value replacer
 * @return {string} The value
 */
export function scrubAddressValue(value: string, s: Scrubber): string {
  if (value.startsWith("Digest ")) {
    return `Digest ${scrubDigest(value.slice("Digest ".length), s).trimStart()}`
  }
  const scrubbed = s
    .text(value)
    .replace(PARAMETER, (_m, name, parameter) => {
      return `;${scrubParameter(name, parameter, s)}`
    })
    .replace(URI_HEADERS, (_m, headers) => `?${s.opaque(headers)}`)
  return listItems(scrubbed)
    .map((item) => {
      const [address] = item.match(ADDRESS) ?? []
      if (address === undefined) return s.opaque(item.trim())
      const rest = item.slice(address.length).trim()
      return rest ? `${address} ${s.opaque(rest)}` : item
    })
    .join(",")
}

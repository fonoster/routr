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
import { MessageRequest, SIPMessage, Via } from "../../types"
import { TraceKind, TraceOutcome, TraceRecord } from "../types"
import { statusCodeOf } from "../status"

/*
 * Facts a rule may read: the SIP messages, the processor contract fields
 * (sender, listening points, external addresses, localnets, receivedOn)
 * and what the dispatcher measured. Never a hop's metadata.
 */

export const inbound = (r: TraceRecord): SIPMessage => r.request.message

export const outbound = (r: TraceRecord): SIPMessage | undefined =>
  r.response?.message

export const isRequest = (r: TraceRecord): boolean =>
  r.kind === TraceKind.REQUEST

export const isResponse = (r: TraceRecord): boolean =>
  r.kind === TraceKind.RESPONSE

export const isForwarded = (r: TraceRecord): boolean =>
  isRequest(r) && r.outcome === TraceOutcome.FORWARDED && !!r.response

export const isRelayed = (r: TraceRecord): boolean =>
  isResponse(r) && r.outcome === TraceOutcome.RELAYED && !!r.response

export const isInDialog = (r: TraceRecord): boolean => !!inbound(r).to?.tag

export const statusOf = (r: TraceRecord): number | undefined =>
  r.status ??
  statusCodeOf(
    isResponse(r) ? inbound(r).responseType : outbound(r)?.responseType
  )

export const headerValues = (
  m: SIPMessage | undefined,
  name: string
): string[] =>
  (m?.extensions || [])
    .filter((e) => e.name.toLowerCase() === name.toLowerCase())
    .map((e) => e.value)

export const cseqOf = (
  m: SIPMessage | undefined
): { number: number; method: string } | undefined => {
  const raw = headerValues(m, "CSeq")[0]
  if (!raw) return undefined
  const [n, method] = raw.trim().split(/\s+/)
  const number = parseInt(n, 10)
  return isNaN(number) ? undefined : { number, method: method || "" }
}

export const topVia = (m: SIPMessage | undefined): Via | undefined =>
  m?.via?.[0]

export const topBranch = (m: SIPMessage | undefined): string | undefined =>
  topVia(m)?.branch

export const isExternalHost = (req: MessageRequest, host?: string): boolean =>
  !!host && (req.externalAddrs || []).includes(host)

/**
 * Whether a host is one of the proxy's own internal interfaces: a listening
 * point, the socket the message came in on, or an address in localnets.
 *
 * @param {MessageRequest} req - The recorded request
 * @param {string} host - Host to test
 * @return {boolean} True for an internal interface
 */
export const isInternalHost = (req: MessageRequest, host?: string): boolean =>
  !!host &&
  ((req.listeningPoints || []).some((lp) => lp.host === host) ||
    req.receivedOn?.host === host ||
    (req.localnets || []).some((net) => inNet(host, net)))

export const isOwnHost = (req: MessageRequest, host?: string): boolean =>
  isExternalHost(req, host) || isInternalHost(req, host)

const inNet = (host: string, net: string): boolean => {
  const [base, bitsRaw] = net.split("/")
  const bits = bitsRaw === undefined ? 32 : parseInt(bitsRaw, 10)
  const a = ipv4(host)
  const b = ipv4(base)
  if (a === undefined || b === undefined || isNaN(bits)) return host === base
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (a & mask) >>> 0 === (b & mask) >>> 0
}

const ipv4 = (s: string): number | undefined => {
  const parts = s.split(".")
  if (parts.length !== 4) return undefined
  let n = 0
  // eslint-disable-next-line no-loops/no-loops
  for (const p of parts) {
    const v = parseInt(p, 10)
    if (isNaN(v) || v < 0 || v > 255) return undefined
    n = (n << 8) | v
  }
  return n >>> 0
}

export const requestsIn = (call: TraceRecord[]): TraceRecord[] =>
  call.filter(isRequest)

/**
 * Identifies the party that sent a request: its From URI and tag. Both are
 * needed, a SIPp-style endpoint may use the same tag on both sides.
 *
 * @param {TraceRecord} r - A request record
 * @return {string} A key equal for every request from the same party
 */
export const directionOf = (r: TraceRecord): string => {
  const from = inbound(r).from
  const uri = from?.address?.uri
  return `${uri?.user ?? ""}@${uri?.host ?? ""};${from?.tag ?? ""}`
}

// Whether an E.164 number: a plus sign and 7 to 15 digits
export const isE164 = (user?: string): boolean =>
  !!user && /^\+[1-9][0-9]{6,14}$/.test(user)

// Parses `<sip:user@host;params>` or `sip:user@host` out of a header value
export const uriOf = (
  value: string
): { user?: string; host?: string; params: string } | undefined => {
  const m = /<?sips?:(?:([^@>;]*)@)?([^>;?]*)([^>]*)>?/.exec(value)
  if (!m) return undefined
  return { user: m[1], host: m[2], params: m[3] || "" }
}

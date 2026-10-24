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
import { Address, SIPMessage, SipURI, Via } from "../types"
import { MessageDiff } from "./types"

/**
 * Renders a SIP URI the way it appears on the wire.
 *
 * @param {SipURI} uri - Parsed URI
 * @return {string} e.g. sip:+1555@sip.provider.net:5060;transport=udp;user=phone
 */
export function formatUri(uri?: SipURI): string {
  if (!uri) return ""
  const scheme = uri.secure ? "sips" : "sip"
  const user = uri.user ? `${uri.user}@` : ""
  const port = uri.port ? `:${uri.port}` : ""
  const params = [
    uri.transportParam ? `transport=${uri.transportParam.toLowerCase()}` : "",
    uri.userParam ? `user=${uri.userParam}` : "",
    uri.lrParam ? "lr" : "",
    uri.methodParam ? `method=${uri.methodParam}` : ""
  ]
    .filter(Boolean)
    .map((p) => `;${p}`)
    .join("")
  return `${scheme}:${user}${uri.host}${port}${params}`
}

/**
 * Renders a name-addr, e.g. "John" <sip:1001@sip.local>.
 *
 * @param {Address} address - Parsed address
 * @return {string} The rendering
 */
export function formatAddress(address?: Address): string {
  if (!address) return ""
  const name = address.displayName ? `"${address.displayName}" ` : ""
  return `${name}<${formatUri(address.uri)}>`
}

/**
 * Renders a Via header value.
 *
 * @param {Via} via - Parsed Via
 * @return {string} e.g. SIP/2.0/UDP 10.0.0.1:5060;branch=z9hG4bK-1;rport
 */
export function formatVia(via: Via): string {
  const params = [
    via.branch ? `branch=${via.branch}` : "",
    via.received ? `received=${via.received}` : "",
    via.rPort ? `rport=${via.rPort}` : via.rPortFlag ? "rport" : ""
  ]
    .filter(Boolean)
    .map((p) => `;${p}`)
    .join("")
  return `SIP/2.0/${via.transport} ${via.host}:${via.port}${params}`
}

const withParams = (
  address: Address,
  parameters?: Record<string, string>
): string =>
  formatAddress(address) +
  Object.entries(parameters || {})
    .map(([k, v]) => (v === "" ? `;${k}` : `;${k}=${v}`))
    .join("")

/**
 * Flattens a message into header name → values, rendered as on the wire.
 * Multi-valued headers (Via, Route, Record-Route) keep one entry per line.
 * The body is summarized by its media lines so SDP changes show up.
 *
 * @param {SIPMessage} message - Parsed message
 * @return {Record<string, string[]>} Headers by canonical name
 */
export function flattenHeaders(message: SIPMessage): Record<string, string[]> {
  const headers: Record<string, string[]> = {}
  const put = (name: string, value?: string | number | null) => {
    if (value === undefined || value === null || value === "") return
    headers[name] = (headers[name] || []).concat(String(value))
  }

  ;(message.via || []).forEach((via) => put("Via", formatVia(via)))
  ;(message.route || []).forEach((r) =>
    put("Route", withParams(r.address, r.parameters))
  )
  ;(message.recordRoute || []).forEach((r) =>
    put("Record-Route", withParams(r.address, r.parameters))
  )
  if (message.from) {
    put(
      "From",
      withParams(message.from.address, {
        ...(message.from.tag ? { tag: message.from.tag } : {}),
        ...message.from.parameters
      })
    )
  }
  if (message.to) {
    put(
      "To",
      withParams(message.to.address, {
        ...(message.to.tag ? { tag: message.to.tag } : {}),
        ...message.to.parameters
      })
    )
  }
  if (message.contact) put("Contact", formatAddress(message.contact.address))
  put("Max-Forwards", message.maxForwards?.maxForwards)
  put("Expires", message.expires?.expires)
  if (message.authorization) {
    put(
      "Authorization",
      `Digest username="${message.authorization.username}", realm="${message.authorization.realm}"`
    )
  }
  if (message.wwwAuthenticate) {
    put(
      "WWW-Authenticate",
      `Digest realm="${message.wwwAuthenticate.realm}", nonce="${message.wwwAuthenticate.nonce}"`
    )
  }
  ;(message.extensions || []).forEach((ext) => put(ext.name, ext.value))

  const media = (message.body || "")
    .split(/\r?\n/)
    .filter((line) => /^(m|c)=/.test(line))
  if (media.length) put("Body", media.join(" "))

  return headers
}

const join = (values: string[]) => values.join(", ")

/**
 * Computes what a component changed between the message it received and
 * the one it returned.
 *
 * @param {SIPMessage} before - Message as it entered the component
 * @param {SIPMessage} after - Message as it left the component
 * @return {MessageDiff} Added, removed and changed headers
 */
export function diffMessages(
  before: SIPMessage,
  after: SIPMessage
): MessageDiff {
  const a = flattenHeaders(before)
  const b = flattenHeaders(after)
  const diff: MessageDiff = { headers: { added: {}, removed: {}, changed: {} } }

  Object.keys(b)
    .filter((name) => !(name in a))
    .forEach((name) => (diff.headers.added[name] = join(b[name])))
  Object.keys(a)
    .filter((name) => !(name in b))
    .forEach((name) => (diff.headers.removed[name] = join(a[name])))
  Object.keys(a)
    .filter((name) => name in b && join(a[name]) !== join(b[name]))
    .forEach(
      (name) =>
        (diff.headers.changed[name] = {
          from: join(a[name]),
          to: join(b[name])
        })
    )

  const uriBefore = formatUri(before.requestUri)
  const uriAfter = formatUri(after.requestUri)
  if (uriBefore && uriAfter && uriBefore !== uriAfter) {
    diff.requestUri = { from: uriBefore, to: uriAfter }
  }

  return diff
}

/**
 * True when a diff carries no change at all.
 *
 * @param {MessageDiff} diff - A diff
 * @return {boolean} Whether it is empty
 */
export function isEmptyDiff(diff: MessageDiff): boolean {
  return (
    !diff.requestUri &&
    Object.keys(diff.headers.added).length === 0 &&
    Object.keys(diff.headers.removed).length === 0 &&
    Object.keys(diff.headers.changed).length === 0
  )
}

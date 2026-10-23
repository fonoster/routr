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
import { Glyphs, UNICODE } from "./glyphs"

/** Semantic colours. The painter never names a hex; the renderer maps these. */
export type Color = "accent" | "danger" | "warn" | "info" | "muted" | "fg"

export interface Segment {
  text: string
  color?: Color
  bold?: boolean
  inverse?: boolean
  dim?: boolean
}

export type Line = Segment[]

/**
 * Makes a segment.
 *
 * @param {string} text - The text
 * @param {Partial<Segment>} style - Style flags
 * @return {Segment} The segment
 */
export const seg = (text: string, style: Partial<Segment> = {}): Segment => ({
  text,
  ...style
})

/**
 * Plain text of a line.
 *
 * @param {Line} line - A line
 * @return {string} Its text
 */
export const textOf = (line: Line): string => line.map((s) => s.text).join("")

/**
 * Visible width of a string. Every glyph the viewer uses is one cell wide,
 * and SIP headers are ASCII, so this is the string length.
 *
 * @param {string} s - A string
 * @return {number} Its width
 */
export const width = (s: string): number => s.length

/**
 * Pads or truncates a string to exactly n cells.
 *
 * @param {string} s - A string
 * @param {number} n - Target width
 * @param {string} ellipsis - Elision glyph
 * @return {string} The fitted string
 */
export function fit(s: string, n: number, ellipsis = UNICODE.ellipsis): string {
  if (n <= 0) return ""
  if (s.length <= n) return s + " ".repeat(n - s.length)
  if (n <= ellipsis.length) return s.slice(0, n)
  return s.slice(0, n - ellipsis.length) + ellipsis
}

/**
 * Right-aligns a string in n cells.
 *
 * @param {string} s - A string
 * @param {number} n - Target width
 * @return {string} The padded string
 */
export const rpad = (s: string, n: number): string =>
  s.length >= n ? s.slice(0, n) : " ".repeat(n - s.length) + s

/**
 * Truncates with an ellipsis only when needed (no padding).
 *
 * @param {string} s - A string
 * @param {number} n - Max width
 * @param {string} ellipsis - Elision glyph
 * @return {string} The string, at most n cells
 */
export function clip(
  s: string,
  n: number,
  ellipsis = UNICODE.ellipsis
): string {
  if (s.length <= n) return s
  if (n <= ellipsis.length) return s.slice(0, Math.max(0, n))
  return s.slice(0, n - ellipsis.length) + ellipsis
}

/**
 * Elides the middle of a string, keeping both ends.
 *
 * @param {string} s - A string
 * @param {number} n - Max width
 * @param {string} ellipsis - Elision glyph
 * @return {string} The string, at most n cells
 */
export function elideMiddle(
  s: string,
  n: number,
  ellipsis = UNICODE.ellipsis
): string {
  if (s.length <= n) return s
  const room = n - ellipsis.length
  if (room < 2) return s.slice(0, n)
  const head = Math.ceil(room / 2)
  return s.slice(0, head) + ellipsis + s.slice(s.length - (room - head))
}

/**
 * Fits a SIP URI: keeps scheme and user, keeps the tail of host:port, and
 * elides the middle of the host. The user is what was dialled; the port and
 * last label tell trunks apart.
 *
 * @param {string} uri - A rendered URI such as sip:123@sip.provider.net:7060
 * @param {number} n - Max width
 * @param {Glyphs} g - Glyph set
 * @return {string} The fitted URI
 */
export function fitUri(uri: string, n: number, g: Glyphs = UNICODE): string {
  if (uri.length <= n) return uri
  const at = uri.indexOf("@")
  if (at < 0) return elideMiddle(uri, n, g.ellipsis)
  const head = uri.slice(0, at + 1)
  const tail = uri.slice(at + 1).replace(/;.*$/, "")
  const room = n - head.length - g.ellipsis.length
  if (room < 4) return clip(uri, n, g.ellipsis)
  return head + g.ellipsis + tail.slice(tail.length - room)
}

/**
 * Fits a Via branch: drops the magic cookie and keeps the tail, which is the
 * unique part of a branch.
 *
 * @param {string} branch - A branch parameter value
 * @param {number} n - Max width
 * @param {Glyphs} g - Glyph set
 * @return {string} The fitted branch
 */
export function fitBranch(
  branch: string,
  n: number,
  g: Glyphs = UNICODE
): string {
  const bare = branch.replace(/^z9hG4bK-?/, "")
  if (bare.length <= n) return bare
  return g.ellipsis + bare.slice(bare.length - (n - g.ellipsis.length))
}

/**
 * Fits a Call-ID: keeps the head (what the UA chose) and the @host tail.
 *
 * @param {string} callId - The Call-ID
 * @param {number} n - Max width
 * @param {Glyphs} g - Glyph set
 * @return {string} The fitted Call-ID
 */
export function fitCallId(
  callId: string,
  n: number,
  g: Glyphs = UNICODE
): string {
  if (callId.length <= n) return callId
  const at = callId.indexOf("@")
  if (at < 0) return clip(callId, n, g.ellipsis)
  const tail = callId.slice(at)
  const room = n - tail.length - g.ellipsis.length
  if (room < 3) return clip(callId, n, g.ellipsis)
  return callId.slice(0, room) + g.ellipsis + tail
}

/**
 * Fits an address host:port/transport without ever splitting it: drops the
 * transport first, then elides the middle of the host.
 *
 * @param {string} address - e.g. 10.111.221.22:5506/UDP
 * @param {number} n - Max width
 * @param {Glyphs} g - Glyph set
 * @return {string} The fitted address
 */
export function fitAddress(
  address: string,
  n: number,
  g: Glyphs = UNICODE
): string {
  if (address.length <= n) return address
  const noTransport = address.replace(/\/[A-Za-z]+$/, "")
  if (noTransport.length <= n) return noTransport
  const port = noTransport.match(/:\d+$/)?.[0] ?? ""
  const host = noTransport.slice(0, noTransport.length - port.length)
  return elideMiddle(host, Math.max(1, n - port.length), g.ellipsis) + port
}

/**
 * Wraps text at token boundaries (spaces, or after a semicolon). A token
 * longer than the width is cut, never a host or tag in the middle of a word
 * that fits.
 *
 * @param {string} text - The text
 * @param {number} n - Width
 * @param {number} indent - Indent of continuation lines
 * @return {string[]} The wrapped lines
 */
export function wrap(text: string, n: number, indent = 0): string[] {
  if (n <= 0) return [text]
  const tokens = text.split(/(?<=[;,])|\s+/).filter((t) => t.length > 0)
  const lines: string[] = []
  let current = ""
  const push = () => {
    if (current.length) lines.push(current)
    current = ""
  }
  tokens.forEach((token) => {
    const sepWidth = current.length && !/[;,]$/.test(current) ? 1 : 0
    const limit = lines.length ? n - indent : n
    if (current.length + sepWidth + token.length <= limit) {
      current += (sepWidth ? " " : "") + token
    } else {
      push()
      let rest = token
      const roomNext = n - indent
      // eslint-disable-next-line no-loops/no-loops
      while (rest.length > roomNext) {
        lines.push(rest.slice(0, roomNext))
        rest = rest.slice(roomNext)
      }
      current = rest
    }
  })
  push()
  return lines.length
    ? lines.map((l, i) => (i ? " ".repeat(indent) + l : l))
    : [""]
}

/**
 * Formats milliseconds for the time gutter.
 *
 * @param {number} ms - Milliseconds
 * @return {string} e.g. 681, 1.002s, 1m02s
 */
export function fmtMs(ms: number): string {
  const v = Math.round(ms)
  if (v < 10000) return `${v}`
  if (v < 60000) return `${(v / 1000).toFixed(3)}s`
  const m = Math.floor(v / 60000)
  const s = Math.floor((v % 60000) / 1000)
  return `${m}m${String(s).padStart(2, "0")}s`
}

/**
 * Formats a duration with a unit, for labels.
 *
 * @param {number} ms - Milliseconds
 * @return {string} e.g. 15.9ms, 4.8 s
 */
export function fmtDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`
  return `${Math.round(ms * 10) / 10}ms`
}

/**
 * Formats an ISO timestamp as HH:MM:SS.mmm UTC.
 *
 * @param {string} iso - ISO 8601 timestamp
 * @param {number} plusMs - Milliseconds to add
 * @return {string} The clock time
 */
export function fmtClock(iso: string, plusMs = 0): string {
  const d = new Date(new Date(iso).getTime() + plusMs)
  return d.toISOString().slice(11, 23)
}

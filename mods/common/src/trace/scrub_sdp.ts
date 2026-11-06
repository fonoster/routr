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
import { Scrubber } from "./create_scrubber"

const CANDIDATE =
  /^(a=candidate:)(\S+)( \d+ \S+ )(\d+) (\S+)( \d+ typ \S+)(?: raddr (\S+))?(.*)$/

const words = (value: string, scrub: (word: string) => string): string =>
  value.split(" ").map(scrub).join(" ")

/**
 * Replaces the values of one SDP line that identify a call or a person,
 * keeping what describes the media.
 *
 * @param {string} line - The line, without its line ending
 * @param {Scrubber} scrubber - The file's value replacer
 * @return {string} The line
 */
function scrubSdpLine(line: string, scrubber: Scrubber): string {
  const { digits, host, opaque, text } = scrubber
  const dash = (value: string) => (value === "-" ? value : opaque(value))

  const origin = line.match(/^o=(\S+) (\S+) (\S+) IN (IP[46]) (\S+)$/)
  if (origin) {
    const [, user, id, version, , address] = origin
    return `o=${dash(user)} ${digits(id)} ${digits(version)} IN IP4 ${host(
      address
    )}`
  }
  if (line.startsWith("s=")) return `s=${dash(line.slice(2))}`

  const candidate = line.match(CANDIDATE)
  if (candidate) {
    const [, start, foundation, middle, priority, address, port, related, end] =
      candidate
    const raddr = related ? ` raddr ${host(related)}` : ""
    return `${start}${opaque(foundation)}${middle}${digits(priority)} ${host(
      address
    )}${port}${raddr}${end}`
  }

  const value = line.match(/^a=(ice-ufrag|ice-pwd|cname|msid):(.*)$/)
  if (value) return `a=${value[1]}:${words(value[2], opaque)}`

  const fingerprint = line.match(/^a=fingerprint:(\S+) (.*)$/)
  if (fingerprint) {
    return `a=fingerprint:${fingerprint[1]} ${opaque(fingerprint[2])}`
  }

  const crypto = line.match(/^(a=crypto:\S+ \S+ inline:)([^\s|]+)(.*)$/)
  if (crypto) return `${crypto[1]}${opaque(crypto[2])}${crypto[3]}`

  const ssrc = line.match(/^a=ssrc:(\d+)(?: ([^:\s]+):(.*))?$/)
  if (ssrc) {
    const attribute = ssrc[2] ? ` ${ssrc[2]}:${words(ssrc[3], opaque)}` : ""
    return `a=ssrc:${digits(ssrc[1])}${attribute}`
  }

  const group = line.match(/^a=ssrc-group:(\S+) (.*)$/)
  if (group) return `a=ssrc-group:${group[1]} ${words(group[2], digits)}`

  const semantic = line.match(/^a=msid-semantic: ?(\S+)(?: (.*))?$/)
  if (semantic) {
    const ids = semantic[2] ? ` ${words(semantic[2], opaque)}` : ""
    return `a=msid-semantic:${semantic[1]}${ids}`
  }

  // Free text, an email, a phone number, a URI or a key: nothing a replay needs
  if (/^[iuepk]=/.test(line))
    return `${line.slice(0, 2)}${opaque(line.slice(2))}`

  return text(line)
}

/**
 * Replaces the values of a message body. An SDP keeps its shape, line by line,
 * and so does the summary of its media lines in a hop's diff. Any other body
 * (a MESSAGE text, a sipfrag) is one value.
 *
 * @param {string} body - The body
 * @param {Scrubber} scrubber - The file's value replacer
 * @return {string} The body
 */
export function scrubBody(body: string, scrubber: Scrubber): string {
  if (/^[mc]=/.test(body)) return scrubber.text(body)
  if (!body.startsWith("v=")) return scrubber.opaque(body)
  return body.replace(/[^\r\n]+/g, (line) => scrubSdpLine(line, scrubber))
}

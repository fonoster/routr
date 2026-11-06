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
import { decodeIdentityUser, IDENTITY_PARAMETER_NAMES } from "../identity"
import { REDACTED } from "./redact"

// Addresses that say nothing about who is on the call; 0.0.0.0 also means "on
// hold" in an SDP
const NOT_IDENTIFYING = ["0.0.0.0", "127.0.0.1"]

// Only an original of this length is searched for, in any string
export const MIN_SEARCHED_LENGTH = 5

const NUMBER = /^\+?\d{7,}$/
const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/
const PRIVATE_IPV4 =
  /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|169\.254\.)/
const SIP_MAGIC_COOKIE = "z9hG4bK"

// The parameters of an address that describe the protocol, lowercase, and those
// the recognizers already replace. Every other parameter's value is replaced
const KEPT_PARAMETERS = new Set([
  ...IDENTITY_PARAMETER_NAMES,
  "branch",
  "counter",
  "expires",
  "id-type",
  "limit",
  "lr",
  "maddr",
  "method",
  "ob",
  "party",
  "privacy",
  "q",
  "r2",
  "reason",
  "received",
  "reg-id",
  "rport",
  "screen",
  "tag",
  "transport",
  "ttl",
  "user"
])
const PARAMETER = /;([^\s;=,<>"?]+)=(?:"((?:[^"\\]|\\.)*)"|([^;,\s>"?]+))/g
const URI_HEADERS = /\?([^>\s"]+)/g

export interface ScrubberOptions {
  // Values that stay as they are: credential usernames and chosen fakes
  pinned: string[]
  // Hosts and addresses that stay as they are
  keepHosts: string[]
}

export interface Scrubber {
  // Stops collecting: from here on each function returns a fake
  seal: () => void
  // Every value that was replaced, as it was in the input
  originals: () => string[]
  // Every fake handed out
  fakes: () => string[]
  opaque: (value: string) => string
  host: (value: string) => string
  user: (value: string) => string
  name: (value: string) => string
  branch: (value: string) => string
  identity: (value: string) => string
  // A free-form string: replaces what it can recognize and every known original
  text: (value: string) => string
  // An address header or a URI: as text, and also its parameters and URI headers
  addressValue: (value: string) => string
  digits: (value: string) => string
}

/**
 * Creates the value replacer of one file. It runs over the file twice: the
 * first time it only learns every original, so that no fake it hands out the
 * second time is also an input value.
 *
 * @param {ScrubberOptions} options - The values to keep
 * @return {Scrubber} The replacer
 */
export function createScrubber(options: ScrubberOptions): Scrubber {
  const kept = new Set([...options.pinned, REDACTED, ...NOT_IDENTIFYING])
  const keptHosts = new Set(options.keepHosts.map((h) => h.toLowerCase()))
  const pinnedDigits = new Set(
    options.pinned.filter((p) => NUMBER.test(p)).map((p) => p.replace("+", ""))
  )
  const originals = new Map<string, { allocate: () => string; key: string }>()
  const assigned = new Map<string, string>()
  const issued = new Set<string>()
  const counters: Record<string, number> = {}
  let sealed = false
  let known: RegExp | undefined

  const isKeptHost = (value: string) =>
    keptHosts.has(value.toLowerCase().replace(/^\[|\]$/g, ""))
  const isFree = (candidate: string) =>
    !originals.has(candidate) &&
    !originals.has(candidate.replace("+", "")) &&
    !kept.has(candidate) &&
    !issued.has(candidate)

  const next = (kind: string, render: (n: number) => string): string => {
    counters[kind] = (counters[kind] ?? 0) + 1
    const candidate = render(counters[kind])
    return isFree(candidate) ? candidate : next(kind, render)
  }

  const assign = (allocate: () => string, key: string): string => {
    if (!assigned.has(key)) {
      const allocated = allocate()
      assigned.set(key, allocated)
      issued.add(allocated)
    }
    return assigned.get(key)
  }

  // One value, one fake. The key lets two spellings of a value share a fake
  const fake = (
    value: string,
    allocate: () => string,
    key: string = value
  ): string => {
    if (!value || kept.has(value) || issued.has(value)) return value
    if (sealed) return assign(allocate, key)
    if (!originals.has(value)) originals.set(value, { allocate, key })
    return value
  }

  const number = (value: string): string => {
    const digits = value.replace("+", "")
    if (pinnedDigits.has(digits)) return value
    return fake(
      value,
      () => next("number", (n) => `+1555555${String(n).padStart(4, "0")}`),
      digits
    )
  }

  const opaque = (value: string): string => {
    if (NUMBER.test(value)) return number(value)
    if (isKeptHost(value)) return value
    return fake(value, () => next("value", (n) => `fake-${n}`))
  }

  const address = (value: string): string =>
    fake(
      value,
      () =>
        PRIVATE_IPV4.test(value)
          ? next("private", (n) => `10.0.0.${n}`)
          : next("public", (n) => `203.0.113.${n}`),
      value.replace(/^\[|\]$/g, "").toLowerCase()
    )

  const host = (value: string): string => {
    if (isKeptHost(value)) return value
    const [, base, suffix] =
      value.match(/^(\[[^\]]+\]|[^:/[\]]+)([:/]\d+)$/) ?? []
    if (base) return `${host(base)}${suffix}`
    if (IPV4.test(value) || value.includes(":")) return address(value)
    return fake(value, () => next("host", (n) => `host-${n}.invalid`))
  }

  const identity = (value: string): string => {
    const decoded = Buffer.from(value, "base64url").toString("utf8")
    const at = decoded.lastIndexOf("@")
    if (at < 0) return opaque(value)
    const [hostPort, ...params] = decoded.slice(at + 1).split(";")
    const user = decoded.slice(0, at)
    return Buffer.from(
      [`${scrubUser(user)}@${host(hostPort)}`, ...params].join(";"),
      "utf8"
    ).toString("base64url")
  }

  const scrubUser = (value: string): string => {
    const mapping = decodeIdentityUser(value)
    if (mapping) {
      return Object.entries(mapping)
        .map(([param, v]) => `${param}.${identity(v)}`)
        .join(".")
    }
    if (NUMBER.test(value)) return number(value)
    if (/^\+?\d+$/.test(value)) return value
    return fake(value, () => next("user", (n) => `user-${n}`))
  }

  const name = (value: string): string =>
    fake(value, () => next("name", (n) => `Caller ${n}`))

  const branch = (value: string): string =>
    value.startsWith(SIP_MAGIC_COOKIE)
      ? `${SIP_MAGIC_COOKIE}${opaque(value.slice(SIP_MAGIC_COOKIE.length))}`
      : opaque(value)

  const digits = (value: string): string =>
    fake(value, () => next("digits", (n) => String(1000 + n)))

  const uri = (
    _m: string,
    scheme: string,
    userInfo: string | undefined,
    target: string,
    headers: string | undefined
  ): string => {
    const query = headers ? `?${opaque(headers.slice(1))}` : ""
    if (scheme === "tel") return `tel:${scrubUser(target)}${query}`
    const [user, password] = (userInfo ?? "").split(":")
    const info = userInfo
      ? `${scrubUser(user)}${password ? `:${opaque(password)}` : ""}@`
      : ""
    return `${scheme}:${info}${host(target)}${query}`
  }

  const identityParameters = IDENTITY_PARAMETER_NAMES.join("|")

  // The order matters: a later pattern must not see what an earlier one owns
  const recognizers: [RegExp, (...groups: string[]) => string][] = [
    [
      new RegExp(`\\b(${identityParameters})=([A-Za-z0-9_-]+)`, "g"),
      (_m, param, value) => `${param}=${identity(value)}`
    ],
    [/"((?:[^"\\]|\\.)*)"(?=\s*<)/g, (_m, value) => `"${name(value)}"`],
    [
      /(^|,\s*)([^"<>,;=]*[^"<>,;=\s])(\s*<(?:sips?|tel):)/g,
      (_m, before, value, after) => `${before}${name(value)}${after}`
    ],
    [
      /\b(username|realm|nonce|cnonce|opaque|response|uri)="([^"]*)"/gi,
      (_m, param, value) => {
        const lower = param.toLowerCase()
        if (lower === "realm") return `${param}="${host(value)}"`
        if (lower === "username") return `${param}="${scrubUser(value)}"`
        if (lower === "uri") return `${param}="${text(value)}"`
        return `${param}="${opaque(value)}"`
      }
    ],
    [
      /\b(sips?|tel):(?:([^@\s<>",]+)@)?(\[[^\]]+\]|[^\s;:,<>"?]+)(\?[^>\s]*)?/g,
      uri as (...groups: string[]) => string
    ],
    [
      /;(tag|branch|received|maddr)=([^;,\s>]+)/gi,
      (_m, param, value) => {
        const lower = param.toLowerCase()
        if (lower === "branch") return `;${param}=${branch(value)}`
        if (lower === "tag") return `;${param}=${opaque(value)}`
        return `;${param}=${host(value)}`
      }
    ],
    [
      /(SIP\/2\.0\/\w+ )(\[[^\]]+\]|[^\s:;,]+)/g,
      (_m, before, value) => `${before}${host(value)}`
    ],
    [
      /\bIP6 ([0-9a-fA-F:.]+)/g,
      (m, value) => (isKeptHost(value) ? m : `IP4 ${host(value)}`)
    ],
    [/\[[0-9a-fA-F:.]*:[0-9a-fA-F:.]*\]/g, (value) => host(value)],
    [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, (value) => host(value)],
    [/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b(?![\w.-]*@)/gi, (value) => host(value)],
    [/(?<![\w.+-])\+?\d{7,}(?![\w.])/g, (value) => number(value)]
  ]

  const text = (value: string): string => {
    const start = known
      ? value.replace(known, (m) => assigned.get(originals.get(m).key))
      : value
    return recognizers.reduce(
      (acc, [pattern, replace]) =>
        acc.replace(pattern, replace as (...groups: unknown[]) => string),
      start
    )
  }

  const addressValue = (value: string): string =>
    text(value)
      .replace(PARAMETER, (m, param, quoted, plain) => {
        if (KEPT_PARAMETERS.has(param.toLowerCase())) return m
        return quoted === undefined
          ? `;${param}=${opaque(plain)}`
          : `;${param}="${opaque(quoted)}"`
      })
      .replace(URI_HEADERS, (_m, headers) => `?${opaque(headers)}`)

  const seal = (): void => {
    sealed = true
    originals.forEach(({ allocate, key }) => assign(allocate, key))
    // Longest first, so a value inside a longer one does not split it
    const searched = [...originals.keys()]
      .filter((v) => v.length >= MIN_SEARCHED_LENGTH)
      .sort((a, b) => b.length - a.length)
      .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    known = searched.length ? new RegExp(searched.join("|"), "g") : undefined
  }

  return {
    seal,
    originals: () => [...originals.keys()],
    fakes: () => [...issued],
    opaque,
    host,
    user: scrubUser,
    name,
    branch,
    identity,
    text,
    addressValue,
    digits
  }
}

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
import { CommonTypes as CT, Trace } from "@routr/common"
import { LoadedTrace } from "./load"

// Everything the views show is derived here, once, from the records.

export interface Lane {
  title: string
  subtitle: string
}

export interface Leg {
  from: number
  to: number
  label: string
  kind: "request" | "response"
  color: "fg" | "muted" | "danger"
}

export interface Row {
  // Index into records
  index: number
  seq: number
  tOffsetMs: number
  deltaMs: number
  clock: string
  inLeg: Leg
  outLeg?: Leg
  // Gutter glyph key
  mark: "none" | "fail" | "challenge" | "dropped" | "retrans"
  rejected: boolean
  // How many identical retransmissions were folded into this row
  retransmissions: number
  // Set when this row is a retransmission of an earlier one
  retransOf?: number
  gapBeforeMs?: number
  hopsSummary: string
}

export type CheckState = "pass" | "fail" | "warn" | "na"

export interface Check {
  state: CheckState
  text: string
  explain: string
}

export interface Verdict {
  word:
    | "FORWARDED"
    | "ANSWERED"
    | "REJECTED"
    | "CHALLENGED"
    | "DROPPED"
    | "INCOMPLETE"
  line: string
  short: string
}

export interface Actor {
  title: string
  lines: string[]
}

export interface PathModel {
  actors: Actor[]
  requestUri?: { from: string; to: string }
  via: { line: string; note: string }[]
  routeIn: string
  routeOut: string
  recordRoute: string
  maxForwards?: { from: number; to: number }
  notes: { color: "accent" | "warn" | "danger"; text: string }[]
  nothingForwarded?: string
}

export interface CallModel {
  file: string
  path: string
  records: Trace.TraceRecord[]
  truncatedLines: number
  totalLines: number
  callId: string
  lanes: Lane[]
  rows: Row[]
  verdict: Verdict
  checks: Check[]
  checksNote?: string
  facts: [string, string][]
  pathModel: PathModel
  // Row indices worth jumping to with n
  problems: number[]
  firstForwarded?: Trace.TraceRecord
  recordedAt: string
}

const PHRASES: Record<number, string> = {
  100: "Trying",
  180: "Ringing",
  181: "Call Is Being Forwarded",
  182: "Queued",
  183: "Session Progress",
  200: "OK",
  202: "Accepted",
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Moved Temporarily",
  305: "Use Proxy",
  380: "Alternative Service",
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Authentication Required",
  408: "Request Timeout",
  410: "Gone",
  413: "Request Entity Too Large",
  414: "Request-URI Too Long",
  415: "Unsupported Media Type",
  416: "Unsupported URI Scheme",
  420: "Bad Extension",
  421: "Extension Required",
  423: "Interval Too Brief",
  480: "Temporarily Unavailable",
  481: "Call/Transaction Does Not Exist",
  482: "Loop Detected",
  483: "Too Many Hops",
  484: "Address Incomplete",
  485: "Ambiguous",
  486: "Busy Here",
  487: "Request Terminated",
  488: "Not Acceptable Here",
  489: "Bad Event",
  491: "Request Pending",
  493: "Undecipherable",
  500: "Server Internal Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Server Time-out",
  505: "Version Not Supported",
  513: "Message Too Large",
  600: "Busy Everywhere",
  603: "Decline",
  604: "Does Not Exist Anywhere",
  606: "Not Acceptable"
}

/**
 * Canonical reason phrase for a status code (RFC 3261 §21).
 *
 * @param {number} status - Status code
 * @param {string} responseType - The proto response type, as a fallback
 * @return {string} The phrase
 */
export function phraseOf(status?: number, responseType?: string): string {
  if (status && PHRASES[status]) return PHRASES[status]
  return Trace.reasonPhraseOf(responseType)
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/**
 * host:port/TRANSPORT of a network interface.
 *
 * @param {CT.NetInterface} a - Interface
 * @return {string} The address
 */
export const addr = (a?: CT.NetInterface): string =>
  a ? `${a.host}:${a.port}${a.transport ? "/" + a.transport : ""}` : ""

const sameEndpoint = (a?: CT.NetInterface, b?: CT.NetInterface) =>
  !!a && !!b && a.host === b.host && a.port === b.port

const cseqOf = (m: CT.SIPMessage) =>
  (m.extensions || []).find((e) => e.name.toLowerCase() === "cseq")?.value || ""

const cseqNumber = (m: CT.SIPMessage) => cseqOf(m).split(" ")[0] || ""

const headerValues = (m: CT.SIPMessage | undefined, name: string): string[] =>
  (m?.extensions || [])
    .filter((e) => e.name.toLowerCase() === name.toLowerCase())
    .map((e) => e.value)

const isResponseRecord = (r: Trace.TraceRecord) =>
  r.kind === Trace.TraceKind.RESPONSE

const isInDialog = (r: Trace.TraceRecord) => !!r.request.message.to?.tag

const statusOf = (r: Trace.TraceRecord): number | undefined =>
  r.status ??
  Trace.statusCodeOf(
    isResponseRecord(r)
      ? r.request.message.responseType
      : r.response?.message?.responseType
  )

/**
 * Label of a message as it appears on an arrow: method and CSeq for a
 * request, status and phrase for a response.
 *
 * @param {Trace.TraceRecord} r - The record
 * @return {string} The label
 */
export function labelOf(r: Trace.TraceRecord): string {
  if (isResponseRecord(r)) {
    const status = statusOf(r)
    return `${status ?? "?"} ${phraseOf(
      status,
      r.request.message.responseType
    )}`
  }
  const re = r.method === "INVITE" && isInDialog(r) ? "re-" : ""
  const c = cseqNumber(r.request.message)
  return `${re}${r.method}${c ? ` c${c}` : ""}`
}

const retransKey = (r: Trace.TraceRecord) =>
  [
    r.kind,
    r.method,
    cseqOf(r.request.message),
    r.status ?? "",
    r.request.message.via?.[0]?.branch ?? ""
  ].join("|")

const hopsSummaryOf = (r: Trace.TraceRecord) =>
  `${r.hops.length} hop${r.hops.length === 1 ? "" : "s"} ${
    Math.round(r.totalMs * 10) / 10
  }ms`

/**
 * Builds the lanes: the first sender, the EdgePort, and the first sender
 * that is not the first one. A fourth party is folded into lane 2.
 *
 * @param {Trace.TraceRecord[]} records - The records
 * @return {object} Lanes and the far-side endpoint
 */
function buildLanes(records: Trace.TraceRecord[]): {
  lanes: Lane[]
  near: CT.NetInterface
  far?: CT.NetInterface
} {
  const first = records[0]
  const near = first.request.sender
  const far = records.find((r) => !sameEndpoint(r.request.sender, near))
    ?.request.sender
  const forwarded = records.find(
    (r) => r.outcome === Trace.TraceOutcome.FORWARDED
  )
  const lp = first.request.listeningPoints?.[0]
  const outHost = forwarded?.response?.message?.via?.[0]?.host
  const nearTitle = first.request.message.from?.address?.uri?.user ?? addr(near)
  const trunkRef = records.find((r) => r.trunkRef)?.trunkRef
  const farTitle =
    trunkRef ||
    forwarded?.response?.message?.requestUri?.host ||
    (far ? addr(far) : "far side")
  const lanes: Lane[] = [
    { title: nearTitle, subtitle: addr(near) },
    {
      title: first.edgePort.ref,
      subtitle: `in ${lp?.host ?? "?"}${
        outHost ? ` ${"·"} out ${outHost}` : ""
      }`
    }
  ]
  if (far || forwarded) {
    lanes.push({
      title: farTitle,
      subtitle: far
        ? addr(far)
        : forwarded?.response?.message?.requestUri
        ? Trace.formatUri(forwarded.response.message.requestUri)
        : ""
    })
  }
  return { lanes, near, far }
}

/**
 * Derives the ladder rows.
 *
 * @param {Trace.TraceRecord[]} records - The records
 * @param {CT.NetInterface} near - Lane 0 endpoint
 * @param {number} laneCount - Number of lanes
 * @return {Row[]} The rows, one per record
 */
function buildRows(
  records: Trace.TraceRecord[],
  near: CT.NetInterface,
  laneCount: number
): Row[] {
  const seen = new Map<string, number>()
  let previousT = 0
  return records.map((r, index) => {
    const senderLane = sameEndpoint(r.request.sender, near)
      ? 0
      : Math.min(2, laneCount - 1)
    const otherLane = senderLane === 0 ? Math.min(2, laneCount - 1) : 0
    const label = labelOf(r)
    const kind = isResponseRecord(r) ? "response" : "request"
    const inLeg: Leg = {
      from: senderLane,
      to: 1,
      label,
      kind,
      color: kind === "response" ? "muted" : "fg"
    }
    let outLeg: Leg | undefined
    let mark: Row["mark"] = "none"
    let rejected = false
    const status = statusOf(r)

    if (r.outcome === Trace.TraceOutcome.FORWARDED && r.response) {
      outLeg = {
        from: 1,
        to: otherLane,
        label: `${label} ${"·"} ${hopsSummaryOf(r)}`,
        kind: "request",
        color: "fg"
      }
    } else if (r.outcome === Trace.TraceOutcome.RELAYED && r.response) {
      outLeg = {
        from: 1,
        to: otherLane,
        label: `${label} ${"·"} ${Math.round(r.totalMs * 10) / 10}ms`,
        kind: "response",
        color: "muted"
      }
    } else if (r.outcome === Trace.TraceOutcome.REJECTED) {
      const challenged = status === 401 || status === 407
      rejected = !challenged
      mark = challenged ? "challenge" : "fail"
      outLeg = {
        from: 1,
        to: senderLane,
        label: `${status ?? "?"} ${phraseOf(
          status,
          r.response?.message?.responseType
        )}`,
        kind: "response",
        color: challenged ? "muted" : "danger"
      }
    } else if (r.outcome === Trace.TraceOutcome.ERROR) {
      rejected = true
      mark = "fail"
      const err = r.hops.find((h) => h.error)?.error || "error"
      outLeg = {
        from: 1,
        to: senderLane,
        label: `error ${"·"} ${err}`,
        kind: "response",
        color: "danger"
      }
    } else {
      mark = "dropped"
    }

    const key = retransKey(r)
    const original = seen.get(key)
    if (original === undefined) seen.set(key, index)
    const deltaMs = index === 0 ? 0 : r.tOffsetMs - previousT
    previousT = r.tOffsetMs

    return {
      index,
      seq: r.seq,
      tOffsetMs: r.tOffsetMs,
      deltaMs,
      clock: r.recordedAt,
      inLeg,
      outLeg,
      mark: original !== undefined ? "retrans" : mark,
      rejected,
      retransmissions: 0,
      retransOf: original,
      gapBeforeMs: deltaMs > 2000 ? deltaMs : undefined,
      hopsSummary: hopsSummaryOf(r)
    }
  })
}

const isExternalHost = (req: CT.MessageRequest, host?: string) =>
  !!host && (req.externalAddrs || []).includes(host)

const isInternalHost = (req: CT.MessageRequest, host?: string) =>
  !!host &&
  ((req.listeningPoints || []).some((lp) => lp.host === host) ||
    (req.localnets || []).some((net) => {
      const prefix = net.split("/")[0].split(".").slice(0, 3).join(".")
      return host.startsWith(prefix + ".")
    }))

/**
 * Runs the spec checks on the first forwarded INVITE.
 *
 * @param {Trace.TraceRecord} r - The forwarded INVITE, if any
 * @return {Check[]} The checks, failures first
 */
function buildChecks(r?: Trace.TraceRecord): Check[] {
  const na = (text: string, explain: string): Check => ({
    state: "na",
    text: `${text}  (no INVITE was forwarded)`,
    explain
  })
  const explain = {
    mf: "RFC 3261 §16.6 requires a proxy to decrement Max-Forwards by one",
    via: "RFC 3261 §16.6 requires the proxy to insert its own Via above the caller's",
    pai: "SIP Connect 1.1 §9 requires a single E.164 identity with user=phone",
    one: "The trunk reads the first P-Asserted-Identity; a second one is ambiguous",
    auth: "Caller credentials are for Routr; forwarding them leaks the digest",
    rr: "Record-Route must name an interface the far side can reach"
  }
  if (!r || !r.response) {
    return [
      na("Max-Forwards decremented", explain.mf),
      na("own Via on top of the stack", explain.via),
      na("P-Asserted-Identity is E.164 with user=phone", explain.pai),
      na("one P-Asserted-Identity reaches the trunk", explain.one),
      na("caller credentials stripped", explain.auth)
    ]
  }
  const inMsg = r.request.message
  const out = r.response.message
  const checks: Check[] = []
  const mfIn = inMsg.maxForwards?.maxForwards
  const mfOut = out.maxForwards?.maxForwards
  checks.push(
    mfIn !== undefined && mfOut === mfIn - 1
      ? {
          state: "pass",
          text: `Max-Forwards decremented ${mfIn} ${"→"} ${mfOut}`,
          explain: explain.mf
        }
      : {
          state: "fail",
          text: `Max-Forwards not decremented (${mfIn} in, ${mfOut} out)`,
          explain: explain.mf
        }
  )
  const viaIn = inMsg.via || []
  const viaOut = out.via || []
  const ownIndex = viaOut.findIndex(
    (v) =>
      isExternalHost(r.request, v.host) || isInternalHost(r.request, v.host)
  )
  checks.push(
    viaOut.length === viaIn.length + 1 && ownIndex === 0
      ? {
          state: "pass",
          text: "own Via on top of the stack",
          explain: explain.via
        }
      : ownIndex < 0
      ? {
          state: "fail",
          text: "own Via missing from the outgoing message",
          explain: explain.via
        }
      : {
          state: "fail",
          text: `own Via is not on top (position ${ownIndex + 1} of ${
            viaOut.length
          })`,
          explain: explain.via
        }
  )
  const pai = headerValues(out, "P-Asserted-Identity")
  if (pai.length) {
    const ok =
      /<sips?:\+[0-9]+@[^>]*;user=phone[^>]*>/.test(pai[0]) ||
      (/<sips?:\+[0-9]+@[^>]*>/.test(pai[0]) && /user=phone/.test(pai[0]))
    checks.push(
      ok
        ? {
            state: "pass",
            text: "P-Asserted-Identity is E.164 with user=phone",
            explain: explain.pai
          }
        : {
            state: "fail",
            text: `P-Asserted-Identity is not E.164: ${pai[0]}`,
            explain: explain.pai
          }
    )
    checks.push(
      pai.length === 1
        ? {
            state: "pass",
            text: "one P-Asserted-Identity reaches the trunk",
            explain: explain.one
          }
        : {
            state: "fail",
            text: `${pai.length} P-Asserted-Identity headers reach the trunk`,
            explain: explain.one
          }
    )
  } else {
    checks.push({
      state: "warn",
      text: "no P-Asserted-Identity on the outgoing message",
      explain: explain.pai
    })
  }
  checks.push(
    !out.authorization && headerValues(out, "Authorization").length === 0
      ? {
          state: "pass",
          text: "caller credentials stripped",
          explain: explain.auth
        }
      : {
          state: "fail",
          text: "Authorization forwarded to the trunk",
          explain: explain.auth
        }
  )
  const rr = out.recordRoute?.[0]?.address?.uri?.host
  const outVia = viaOut[0]?.host
  if (rr && outVia && rr !== outVia && isInternalHost(r.request, rr)) {
    checks.push({
      state: "warn",
      text: `Record-Route names ${rr}, an internal interface; the trunk was reached from ${outVia}`,
      explain: explain.rr
    })
  }
  const order: Record<CheckState, number> = { fail: 0, warn: 1, pass: 2, na: 3 }
  return checks.sort((a, b) => order[a.state] - order[b.state])
}

/**
 * Builds the path view model from the first forwarded INVITE.
 *
 * @param {Trace.TraceRecord[]} records - All records
 * @param {Lane[]} lanes - The lanes
 * @param {Trace.TraceRecord} fwd - The forwarded INVITE, if any
 * @return {PathModel} The model
 */
function buildPath(
  records: Trace.TraceRecord[],
  lanes: Lane[],
  fwd?: Trace.TraceRecord
): PathModel {
  const first = records[0]
  const req = first.request
  const inLp =
    req.listeningPoints?.find((lp) => lp.transport === req.sender.transport) ||
    req.listeningPoints?.[0]
  const nearInLocalnet = isInternalHost(req, req.sender.host)
  const actors: Actor[] = [
    {
      title: lanes[0].title,
      lines: [
        addr(req.sender),
        nearInLocalnet ? "in localnet" : "outside localnet"
      ]
    }
  ]
  if (!fwd || !fwd.response) {
    actors.push({ title: first.edgePort.ref, lines: [`in  ${addr(inLp)}`] })
    const rejected = records.find(
      (r) =>
        r.outcome === Trace.TraceOutcome.REJECTED ||
        r.outcome === Trace.TraceOutcome.ERROR
    )
    const status = rejected ? statusOf(rejected) : undefined
    const err = rejected?.hops.find((h) => h.error)?.error
    const who = rejected?.hops
      .filter((h) => h.action === Trace.HopAction.RESPONDED)
      .pop()?.component
    return {
      actors,
      via: [],
      routeIn: "",
      routeOut: "",
      recordRoute: "",
      notes: [],
      nothingForwarded: rejected
        ? `no message was forwarded; ${
            who
              ? `the ${who.replace("-processor", " processor")} answered`
              : "the proxy answered"
          } ${status ?? ""}${err ? `: ${err}` : ""}`.trim()
        : "no message was forwarded"
    }
  }
  const out = fwd.response.message
  const outVia = out.via?.[0]
  actors.push({
    title: first.edgePort.ref,
    lines: [
      `in  ${addr(inLp)}`,
      `out ${
        outVia ? `${outVia.host}:${outVia.port}/${outVia.transport}` : "?"
      }`
    ]
  })
  actors.push({
    title: lanes[2]?.title ?? "far side",
    lines: [
      out.requestUri
        ? `${out.requestUri.host}${
            out.requestUri.port ? ":" + out.requestUri.port : ""
          }`
        : "",
      lanes[2]?.subtitle && lanes[2].subtitle !== lanes[2].title
        ? `= ${lanes[2].subtitle}`
        : ""
    ].filter(Boolean)
  })
  const via = (out.via || []).map((v, i) => ({
    line: `[${(out.via || []).length - i}] ${Trace.formatVia(v)}`,
    note: i === 0 ? "ours, added on egress" : "caller"
  }))
  const rr =
    out.recordRoute
      ?.map((r) => `<${Trace.formatUri(r.address.uri)}>`)
      .join(" ") || ""
  const notes: PathModel["notes"] = []
  const rrHost = out.recordRoute?.[0]?.address?.uri?.host
  if (
    rrHost &&
    outVia &&
    rrHost !== outVia.host &&
    isInternalHost(req, rrHost)
  ) {
    notes.push({
      color: "warn",
      text: `Record-Route names ${rrHost}, an internal interface; the trunk was reached from ${outVia.host}. Replies and in-dialog requests from the far side will target it.`
    })
  }
  const mfIn = fwd.request.message.maxForwards?.maxForwards
  const mfOut = out.maxForwards?.maxForwards
  notes.push({
    color: "accent",
    text: `Max-Forwards ${mfIn} ${"→"} ${mfOut} ${"·"} own Via on top ${"·"} user part kept, host rewritten to the trunk`
  })
  return {
    actors,
    requestUri: {
      from: Trace.formatUri(fwd.request.message.requestUri),
      to: Trace.formatUri(out.requestUri)
    },
    via,
    routeIn:
      fwd.request.message.route
        ?.map((r) => Trace.formatUri(r.address.uri))
        .join(", ") || "none in",
    routeOut:
      out.route?.map((r) => Trace.formatUri(r.address.uri)).join(", ") ||
      "none out",
    recordRoute: rr,
    maxForwards:
      mfIn !== undefined && mfOut !== undefined
        ? { from: mfIn, to: mfOut }
        : undefined,
    notes
  }
}

/**
 * Builds everything the views need from a loaded trace.
 *
 * @param {LoadedTrace} loaded - The loaded file
 * @return {CallModel} The model
 */
export function analyze(loaded: LoadedTrace): CallModel {
  const { records } = loaded
  const { lanes, near } = buildLanes(records)
  const rows = buildRows(records, near, lanes.length)
  rows.forEach((row) => {
    if (row.retransOf !== undefined) rows[row.retransOf].retransmissions += 1
  })
  const firstInvite = records.find(
    (r) =>
      r.kind === Trace.TraceKind.REQUEST &&
      r.method === "INVITE" &&
      r.outcome === Trace.TraceOutcome.FORWARDED
  )
  const firstForwarded =
    firstInvite ||
    records.find((r) => r.outcome === Trace.TraceOutcome.FORWARDED)
  // The SIP Connect checks are about the INVITE a trunk receives
  const checks = buildChecks(firstInvite)
  const failed = checks.filter((c) => c.state === "fail").length
  const warned = checks.filter((c) => c.state === "warn").length
  const rejectedRows = rows.filter(
    (r) => r.rejected && r.retransOf === undefined
  )
  const requests = records.filter((r) => r.kind === Trace.TraceKind.REQUEST)
  const anyForwarded = requests.some(
    (r) => r.outcome === Trace.TraceOutcome.FORWARDED
  )
  const anyChallenged = rows.some((r) => r.mark === "challenge")
  const firstAnswered = records.find(
    (r) => r.outcome === Trace.TraceOutcome.ANSWERED
  )
  const count = records.length

  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`
  const checksPart = failed
    ? `${plural(failed, "check")} failed`
    : warned
    ? `${plural(warned, "warning")}`
    : ""
  let verdict: Verdict
  if (loaded.truncatedLines && count === 0) {
    verdict = {
      word: "INCOMPLETE",
      line: `INCOMPLETE  0 of ${loaded.totalLines} records readable`,
      short: "INCOMPLETE"
    }
  } else if (rejectedRows.length) {
    const first = records[rejectedRows[0].index]
    const status = statusOf(first)
    const who = first.trunkRef ? ` from ${first.trunkRef}` : ""
    verdict = {
      word: "REJECTED",
      line: `REJECTED ${status ?? ""} at +${Math.round(
        first.tOffsetMs
      )} ms  ${labelOf(first)}${who}  ${
        rejectedRows.length
      } of ${count} messages rejected`,
      short: `REJECTED ${status ?? ""}`.trim()
    }
  } else if (anyForwarded && firstForwarded) {
    const ms = `${Math.round(firstForwarded.totalMs * 10) / 10} ms`
    verdict = {
      word: "FORWARDED",
      line: `FORWARDED  ${ms}  ${plural(count, "message")}  0 rejected${
        checksPart ? "  " + checksPart : ""
      }`,
      short: `FORWARDED ${ms}`
    }
  } else if (firstAnswered) {
    verdict = {
      word: "ANSWERED",
      line: `ANSWERED ${statusOf(firstAnswered) ?? ""}  ${labelOf(
        firstAnswered
      )}  ${plural(count, "message")}`,
      short: `ANSWERED ${statusOf(firstAnswered) ?? ""}`.trim()
    }
  } else if (anyChallenged) {
    verdict = {
      word: "CHALLENGED",
      line: `CHALLENGED 401  waiting for credentials  ${plural(
        count,
        "message"
      )}`,
      short: "CHALLENGED 401"
    }
  } else {
    verdict = {
      word: "DROPPED",
      line: `DROPPED  no message was forwarded  ${plural(count, "message")}`,
      short: "DROPPED"
    }
  }
  if (loaded.truncatedLines) {
    verdict.line += ` ${"·"} incomplete`
    verdict.short += ` ${"·"} incomplete`
  }

  const first = records[0]
  const fwdOut = firstForwarded?.response?.message
  const direction = headerValues(fwdOut, "X-Call-Direction")[0]
  const pai = headerValues(fwdOut, "P-Asserted-Identity")
  const from = first.request.message.from?.address?.uri
  const to = first.request.message.to?.address?.uri
  const facts: [string, string][] = [
    [
      "Call",
      `${from?.user ?? "?"}@${from?.host ?? "?"} ${"→"} ${
        to?.user ?? to?.host ?? "?"
      }`
    ],
    ["Direction", direction || "n/a"],
    [
      "Trunk",
      records.find((r) => r.trunkRef)?.trunkRef || lanes[2]?.title || "n/a"
    ],
    [
      "EdgePort",
      `${first.edgePort.ref}${
        first.edgePort.version ? " " + first.edgePort.version : ""
      }`
    ],
    [
      "Dispatcher",
      `${first.dispatcher.ref}${
        first.dispatcher.version ? " " + first.dispatcher.version : ""
      }`
    ],
    ["Recorded", first.recordedAt.replace("T", " ").replace(/\.\d+Z$/, " UTC")]
  ]
  if (pai.length) facts.push(["Identity", pai.join(" | ")])

  const inviteCount = requests.filter(
    (r) => r.method === "INVITE" && r.outcome === Trace.TraceOutcome.FORWARDED
  ).length
  const checksNote =
    inviteCount > 1
      ? `checks cover the first forwarded INVITE; ${
          inviteCount - 1
        } more INVITE${inviteCount - 1 === 1 ? "" : "s"} in this call`
      : undefined

  const problems = rows
    .filter((r) => r.rejected && r.retransOf === undefined)
    .map((r) => r.index)

  return {
    file: loaded.file,
    path: loaded.path,
    records,
    truncatedLines: loaded.truncatedLines,
    totalLines: loaded.totalLines,
    callId: first.callId,
    lanes,
    rows,
    verdict,
    checks,
    checksNote,
    facts,
    pathModel: buildPath(records, lanes, firstForwarded),
    problems,
    firstForwarded,
    recordedAt: first.recordedAt
  }
}

// ---------- diffs ----------

export interface DiffRow {
  kind: "changed" | "added" | "removed"
  name: string
  from?: string
  to?: string
  value?: string
  by: string
}

/**
 * The header diff of a whole record, incoming → outgoing, with the hop
 * that made each change. Changed first, then added, then removed.
 *
 * @param {Trace.TraceRecord} r - The record
 * @return {DiffRow[]} The rows
 */
export function recordDiff(r: Trace.TraceRecord): DiffRow[] {
  if (!r.response) return []
  const whole = Trace.diffMessages(r.request.message, r.response.message)
  const by = (name: string): string => {
    const hops = r.hops.filter((h) => h.diff)
    const last = hops
      .slice()
      .reverse()
      .find((h) => {
        const d = h.diff!
        if (name === "Request-URI") return !!d.requestUri
        return (
          name in d.headers.added ||
          name in d.headers.removed ||
          name in d.headers.changed
        )
      })
    return last?.component ?? (hops.length === 1 ? hops[0].component : "")
  }
  const rows: DiffRow[] = []
  if (whole.requestUri) {
    rows.push({
      kind: "changed",
      name: "Request-URI",
      from: whole.requestUri.from,
      to: whole.requestUri.to,
      by: by("Request-URI")
    })
  }
  Object.keys(whole.headers.changed)
    .sort()
    .forEach((name) =>
      rows.push({
        kind: "changed",
        name,
        from: whole.headers.changed[name].from,
        to: whole.headers.changed[name].to,
        by: by(name)
      })
    )
  Object.keys(whole.headers.added)
    .sort()
    .forEach((name) => {
      const values = whole.headers.added[name].split(", ")
      const multi =
        values.length > 1 &&
        /^(P-Asserted-Identity|Via|Route|Record-Route)$/i.test(name)
      ;(multi ? values : [whole.headers.added[name]]).forEach((value, i) =>
        rows.push({
          kind: "added",
          name: multi ? `${name}[${i + 1}]` : name,
          value,
          by: by(name)
        })
      )
    })
  Object.keys(whole.headers.removed)
    .sort()
    .forEach((name) =>
      rows.push({
        kind: "removed",
        name,
        value: whole.headers.removed[name],
        by: by(name)
      })
    )
  return rows
}

/**
 * The outgoing message of A against the outgoing message of B.
 *
 * @param {Trace.TraceRecord} a - Record from file A
 * @param {Trace.TraceRecord} b - Record from file B
 * @return {DiffRow[]} The rows, "by" is A or B
 */
export function abDiff(a: Trace.TraceRecord, b: Trace.TraceRecord): DiffRow[] {
  const ma = a.response?.message ?? a.request.message
  const mb = b.response?.message ?? b.request.message
  const d = Trace.diffMessages(ma, mb)
  const rows: DiffRow[] = []
  if (d.requestUri)
    rows.push({
      kind: "changed",
      name: "Request-URI",
      from: d.requestUri.from,
      to: d.requestUri.to,
      by: "A→B"
    })
  Object.keys(d.headers.changed)
    .sort()
    .forEach((name) =>
      rows.push({
        kind: "changed",
        name,
        from: d.headers.changed[name].from,
        to: d.headers.changed[name].to,
        by: "A→B"
      })
    )
  Object.keys(d.headers.added)
    .sort()
    .forEach((name) =>
      rows.push({ kind: "added", name, value: d.headers.added[name], by: "B" })
    )
  Object.keys(d.headers.removed)
    .sort()
    .forEach((name) =>
      rows.push({
        kind: "removed",
        name,
        value: d.headers.removed[name],
        by: "A"
      })
    )
  return rows
}

// ---------- compare ----------

export interface CompareRow {
  a?: Trace.TraceRecord
  b?: Trace.TraceRecord
  state: "same" | "differs" | "onlyA" | "onlyB"
  why?: string
}

const alignKey = (r: Trace.TraceRecord) =>
  `${r.kind}|${r.method}|${cseqOf(r.request.message)}${
    r.kind === "response" ? "|" + (r.status ?? "") : ""
  }`

const outgoingSignature = (r: Trace.TraceRecord) =>
  r.response ? JSON.stringify(Trace.flattenHeaders(r.response.message)) : ""

/**
 * Why two aligned records differ, or undefined when they agree.
 *
 * @param {Trace.TraceRecord} a - Record from file A
 * @param {Trace.TraceRecord} b - Record from file B
 * @return {string | undefined} The first difference
 */
export function whyDiffers(
  a: Trace.TraceRecord,
  b: Trace.TraceRecord
): string | undefined {
  if (a.outcome !== b.outcome) return `outcome ${a.outcome} vs ${b.outcome}`
  const sa = statusOf(a)
  const sb = statusOf(b)
  if (sa !== sb) return `status ${sa ?? "none"} vs ${sb ?? "none"}`
  if (a.hops.length !== b.hops.length)
    return `${a.hops.length} vs ${b.hops.length} hops`
  if (outgoingSignature(a) !== outgoingSignature(b)) {
    const d = abDiff(a, b)
    const first = d[0]
    return first ? `${first.name} ${first.kind}` : "outgoing headers differ"
  }
  return undefined
}

/**
 * Lines up two traces with a longest-common-subsequence over
 * kind|method|CSeq|status.
 *
 * @param {Trace.TraceRecord[]} a - Records of file A
 * @param {Trace.TraceRecord[]} b - Records of file B
 * @return {CompareRow[]} The aligned rows
 */
export function alignTraces(
  a: Trace.TraceRecord[],
  b: Trace.TraceRecord[]
): CompareRow[] {
  const n = a.length
  const m = b.length
  const L: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0)
  )
  // eslint-disable-next-line no-loops/no-loops
  for (let i = n - 1; i >= 0; i--) {
    // eslint-disable-next-line no-loops/no-loops
    for (let j = m - 1; j >= 0; j--) {
      L[i][j] =
        alignKey(a[i]) === alignKey(b[j])
          ? 1 + L[i + 1][j + 1]
          : Math.max(L[i + 1][j], L[i][j + 1])
    }
  }
  const rows: CompareRow[] = []
  let i = 0
  let j = 0
  // eslint-disable-next-line no-loops/no-loops
  while (i < n && j < m) {
    if (alignKey(a[i]) === alignKey(b[j])) {
      const why = whyDiffers(a[i], b[j])
      rows.push({ a: a[i], b: b[j], state: why ? "differs" : "same", why })
      i++
      j++
    } else if (L[i + 1][j] >= L[i][j + 1]) {
      rows.push({ a: a[i++], state: "onlyA" })
    } else {
      rows.push({ b: b[j++], state: "onlyB" })
    }
  }
  // eslint-disable-next-line no-loops/no-loops
  while (i < n) rows.push({ a: a[i++], state: "onlyA" })
  // eslint-disable-next-line no-loops/no-loops
  while (j < m) rows.push({ b: b[j++], state: "onlyB" })
  return rows
}

/**
 * One-line description of a record for the compare table.
 *
 * @param {Trace.TraceRecord} r - The record
 * @return {string} e.g. INVITE c2 → forwarded · 3 hops · 15.9 ms
 */
export function describe(r: Trace.TraceRecord): string {
  const status = statusOf(r)
  const tail =
    r.outcome === Trace.TraceOutcome.REJECTED
      ? ` ${status ?? ""} ${phraseOf(
          status,
          r.response?.message?.responseType
        )}`
      : r.outcome === Trace.TraceOutcome.ERROR
      ? ` ${r.hops.find((h) => h.error)?.error?.split(":")[0] ?? "error"}`
      : ""
  return `${labelOf(r)} ${"→"} ${r.outcome}${tail} ${"·"} ${hopsSummaryOf(r)}`
}

/**
 * Header lines of the incoming message in SIP order, for the detail pane.
 *
 * @param {Trace.TraceRecord} r - The record
 * @return {string[]} Lines such as "Via: SIP/2.0/UDP ..."
 */
export function headerLines(r: Trace.TraceRecord): string[] {
  const m = r.request.message
  const flat = Trace.flattenHeaders(m)
  const lines: string[] = []
  const put = (name: string) =>
    (flat[name] || []).forEach((v) => lines.push(`${name}: ${v}`))
  ;["Via", "Route", "Record-Route", "From", "To"].forEach(put)
  lines.push(`Call-ID: ${r.callId}`)
  put("Contact")
  const seen = new Set([
    "Via",
    "Route",
    "Record-Route",
    "From",
    "To",
    "Contact",
    "Body",
    "Authorization"
  ])
  ;(m.extensions || []).forEach((e) => {
    seen.add(e.name)
    lines.push(
      `${e.name}: ${e.value === Trace.REDACTED ? "(redacted)" : e.value}`
    )
  })
  Object.keys(flat)
    .filter((k) => !seen.has(k))
    .forEach(put)
  if (m.authorization) {
    lines.push(
      `Authorization: Digest username="${m.authorization.username}", realm="${
        m.authorization.realm
      }" ${"…"} (redacted)`
    )
  }
  if (flat["Body"]) lines.push(`Body: ${flat["Body"].join(" ")}`)
  return lines
}

/**
 * Summary of what a hop changed, as chips: +Via −Authorization ~Max-Forwards.
 *
 * @param {Trace.TraceHop} h - The hop
 * @param {object} g - Glyphs for added, removed, changed
 * @return {string[]} The chips
 */
export function hopChips(
  h: Trace.TraceHop,
  g: { added: string; removed: string; changed: string }
): string[] {
  if (!h.diff) return []
  const d = h.diff
  return [
    ...(d.requestUri ? [`${g.changed}Request-URI`] : []),
    ...Object.keys(d.headers.added).map((k) => `${g.added}${k}`),
    ...Object.keys(d.headers.removed).map((k) => `${g.removed}${k}`),
    ...Object.keys(d.headers.changed).map((k) => `${g.changed}${k}`)
  ]
}

export const isResponse = isResponseRecord
export const statusCode = statusOf

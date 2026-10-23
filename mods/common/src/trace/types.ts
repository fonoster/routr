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
import { MessageRequest, SIPMessage } from "../types"

/**
 * Version of the trace record format written by this build. Readers reject
 * records whose traceVersion is not in SUPPORTED_TRACE_VERSIONS.
 */
export const TRACE_VERSION = 1

export const SUPPORTED_TRACE_VERSIONS: ReadonlyArray<number> = [1]

/**
 * Prefix of the metadata keys reserved for the trace. A middleware or a
 * processor may put any `trace.*` key in the metadata of its response: the
 * dispatcher copies those keys into the hop's `metadata` and removes them
 * before the message reaches the EdgePort. Routr draws no conclusion from
 * them (components are swappable); they are there for people and tools
 * reading the file.
 */
export const TRACE_METADATA_PREFIX = "trace."

/**
 * The one reserved key with a meaning: a processor sets it on a routed
 * message to ask the dispatcher to record the call. The value is the ref
 * of the resource (trunk, agent, peer, domain) that asked for it. It is
 * never copied into a hop.
 */
export const TRACE_FLAG_METADATA_KEY = "trace.record"

/**
 * Extended attribute of a connect resource (Trunk, Agent, Peer, Domain)
 * that turns recording on for the calls that touch it.
 */
export const RECORD_MESSAGES_ATTRIBUTE = "recordMessages"

/** Rule profiles a lint run can evaluate. */
export enum Profile {
  // RFC 3261 and companions; always on
  SIP = "sip",
  // SIPconnect 1.1 Technical Recommendation; opt-in
  SIP_CONNECT = "sip-connect"
}

export enum Severity {
  ERROR = "error",
  WARNING = "warning"
}

/** One rule firing on one record. */
export interface Finding {
  // Rule id, e.g. "sip/max-forwards"
  rule: string
  profile: Profile
  severity: Severity
  // Spec citation, e.g. "RFC 3261 §16.6"
  spec: string
  // One sentence a person reads
  message: string
  // Which side of the record the finding points at
  side: "in" | "out" | "call"
  header?: string
}

/** Which rule set produced the findings written on a record. */
export interface TraceLint {
  version: string
  profiles: Profile[]
}

export enum TraceKind {
  REQUEST = "request",
  RESPONSE = "response"
}

export enum TraceOutcome {
  // A request left the dispatcher as a request (towards the next hop)
  FORWARDED = "forwarded",
  // A response left the dispatcher as a response (towards the previous hop)
  RELAYED = "relayed",
  // A request was answered by a component with a final 2xx (e.g. REGISTER 200)
  ANSWERED = "answered",
  // A request was answered by a component with a 3xx-6xx response
  REJECTED = "rejected",
  // A component failed and the dispatcher returned an error to the EdgePort
  ERROR = "error"
}

export enum HopKind {
  DISPATCHER = "dispatcher",
  MIDDLEWARE = "middleware",
  PROCESSOR = "processor"
}

export enum HopAction {
  // The dispatcher selected a processor for the message
  MATCHED = "matched",
  // A middleware returned the message unchanged
  PASS_THROUGH = "pass-through",
  // A component returned the message, possibly altered, as a request
  FORWARDED = "forwarded",
  // A component answered the request with a response
  RESPONDED = "responded",
  // A component relayed a response
  RELAYED = "relayed",
  // A component failed or was unavailable
  ERROR = "error"
}

export interface HeaderChange {
  from: string
  to: string
}

export interface MessageDiff {
  requestUri?: HeaderChange
  headers: {
    added: Record<string, string>
    removed: Record<string, string>
    changed: Record<string, HeaderChange>
  }
}

export interface TraceHop {
  component: string
  kind: HopKind
  version?: string
  durationMs: number
  action: HopAction
  diff?: MessageDiff
  error?: string
  // trace.* keys the component put in its response metadata, prefix removed
  metadata?: Record<string, string>
}

export interface TraceComponent {
  ref: string
  version?: string
}

export interface TraceResponse {
  message: SIPMessage
  metadata?: Record<string, string>
}

export interface TraceRecord {
  traceVersion: number
  recordedAt: string
  callId: string
  seq: number
  tOffsetMs: number
  kind: TraceKind
  method: string
  status?: number
  edgePort: TraceComponent
  dispatcher: TraceComponent
  trunkRef?: string
  request: MessageRequest
  hops: TraceHop[]
  response: TraceResponse | null
  outcome: TraceOutcome
  totalMs: number
  // Present when the dispatcher evaluated rules while writing the record
  lint?: TraceLint
  findings?: Finding[]
}

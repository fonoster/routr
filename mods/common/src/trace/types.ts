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
 * Metadata key a processor sets on a routed message to ask the dispatcher
 * to record the call. The value is the ref of the trunk that asked for it.
 * The dispatcher removes the key before the message leaves.
 */
export const TRACE_FLAG_METADATA_KEY = "routr.trace"

/**
 * Trunk extended attribute that turns recording on for calls using it.
 */
export const TRUNK_RECORD_ATTRIBUTE = "recordMessages"

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
}

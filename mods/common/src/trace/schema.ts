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
import {
  HopAction,
  HopKind,
  Profile,
  Severity,
  TraceKind,
  TraceOutcome
} from "./types"

const headerChange = {
  type: "object",
  properties: {
    from: { type: "string" },
    to: { type: "string" }
  },
  required: ["from", "to"],
  additionalProperties: false
}

const stringMap = {
  type: "object",
  additionalProperties: { type: "string" }
}

const component = {
  type: "object",
  properties: {
    ref: { type: "string" },
    version: { type: "string" }
  },
  required: ["ref"],
  additionalProperties: false
}

const diff = {
  type: "object",
  properties: {
    requestUri: headerChange,
    headers: {
      type: "object",
      properties: {
        added: stringMap,
        removed: stringMap,
        changed: { type: "object", additionalProperties: headerChange }
      },
      required: ["added", "removed", "changed"],
      additionalProperties: false
    }
  },
  required: ["headers"],
  additionalProperties: false
}

const hop = {
  type: "object",
  properties: {
    component: { type: "string", minLength: 1 },
    kind: { type: "string", enum: Object.values(HopKind) },
    version: { type: "string" },
    durationMs: { type: "number", minimum: 0 },
    action: { type: "string", enum: Object.values(HopAction) },
    diff,
    error: { type: "string" },
    metadata: stringMap
  },
  required: ["component", "kind", "durationMs", "action"],
  additionalProperties: false
}

// A processor-generated response (a 401 challenge, a 404) carries only the
// fields the processor set; the EdgePort completes it from the request.
// So only the shape is checked here, no header is required.
const sipMessage = {
  type: "object",
  properties: {
    messageType: { type: "string" },
    // proto-loader emits null for unset message fields
    from: { type: ["object", "null"] },
    to: { type: ["object", "null"] },
    via: { type: "array" },
    extensions: { type: "array" }
  }
}

const netInterface = {
  type: "object",
  properties: {
    host: { type: "string" },
    port: { type: "integer" },
    transport: { type: "string" }
  },
  required: ["host", "port", "transport"]
}

const request = {
  type: "object",
  properties: {
    ref: { type: "string" },
    edgePortRef: { type: "string" },
    method: { type: "string" },
    sender: { type: "object" },
    listeningPoints: { type: "array" },
    externalAddrs: { type: "array", items: { type: "string" } },
    localnets: { type: "array", items: { type: "string" } },
    message: sipMessage,
    metadata: stringMap,
    edgePortVersion: { type: "string" },
    receivedOn: netInterface
  },
  required: ["ref", "edgePortRef", "method", "sender", "message"]
}

const finding = {
  type: "object",
  properties: {
    rule: { type: "string", minLength: 1 },
    profile: { type: "string", enum: Object.values(Profile) },
    severity: { type: "string", enum: Object.values(Severity) },
    spec: { type: "string" },
    message: { type: "string" },
    side: { type: "string", enum: ["in", "out", "call"] },
    header: { type: "string" }
  },
  required: ["rule", "profile", "severity", "spec", "message", "side"],
  additionalProperties: false
}

const lint = {
  type: "object",
  properties: {
    version: { type: "string" },
    profiles: {
      type: "array",
      items: { type: "string", enum: Object.values(Profile) }
    }
  },
  required: ["version", "profiles"],
  additionalProperties: false
}

const response = {
  type: ["object", "null"],
  properties: {
    message: sipMessage,
    metadata: stringMap
  },
  required: ["message"]
}

/**
 * JSON Schema (draft-07) for one line of a trace file, traceVersion 1.
 * The envelope is strict; the SIP message payloads mirror the processor
 * proto and are validated only for shape.
 */
export const traceRecordSchema = {
  title: "Routr trace record",
  type: "object",
  properties: {
    traceVersion: { type: "integer", const: 1 },
    recordedAt: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}T" },
    callId: { type: "string", minLength: 1 },
    seq: { type: "integer", minimum: 1 },
    tOffsetMs: { type: "number", minimum: 0 },
    kind: { type: "string", enum: Object.values(TraceKind) },
    method: { type: "string", minLength: 1 },
    status: { type: "integer", minimum: 100, maximum: 699 },
    edgePort: component,
    dispatcher: component,
    trunkRef: { type: "string" },
    request,
    hops: { type: "array", items: hop },
    response,
    outcome: { type: "string", enum: Object.values(TraceOutcome) },
    totalMs: { type: "number", minimum: 0 },
    lint,
    findings: { type: "array", items: finding }
  },
  required: [
    "traceVersion",
    "recordedAt",
    "callId",
    "seq",
    "tOffsetMs",
    "kind",
    "method",
    "edgePort",
    "dispatcher",
    "request",
    "hops",
    "response",
    "outcome",
    "totalMs"
  ],
  additionalProperties: false
}

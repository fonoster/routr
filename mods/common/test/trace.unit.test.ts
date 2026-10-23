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
import chai from "chai"
import {
  diffMessages,
  flattenHeaders,
  formatUri,
  HopAction,
  HopKind,
  isEmptyDiff,
  parseTrace,
  reasonPhraseOf,
  REDACTED,
  redactRequest,
  statusCodeOf,
  TraceKind,
  TraceOutcome,
  TraceRecord,
  TraceValidationError,
  UnsupportedTraceVersionError,
  validateRecord
} from "../src/trace"
import {
  MessageRequest,
  MessageType,
  Method,
  ResponseType,
  SIPMessage,
  Transport
} from "../src/types"

const expect = chai.expect

const message = (): SIPMessage =>
  ({
    messageType: MessageType.REQUEST,
    requestUri: { user: "17853178070", host: "sip.local" },
    from: {
      address: {
        displayName: "John Doe",
        uri: { user: "1001", host: "sip.local" }
      },
      tag: "1"
    },
    to: { address: { uri: { user: "17853178070", host: "sip.local" } } },
    contact: {
      address: { uri: { user: "1001", host: "10.0.0.2", port: 5060 } },
      expires: 0,
      qValue: 0
    },
    callId: { callId: "1-25@10.0.0.2" },
    contentLength: { contentLength: 0 },
    maxForwards: { maxForwards: 70 },
    authorization: {
      realm: "sip.local",
      scheme: "Digest",
      nonce: "abc",
      cNonce: "def",
      nonceCount: 1,
      response: "7a0c1b",
      username: "1001",
      uri: "sip:sip.local",
      algorithm: "MD5",
      qop: "auth",
      opaque: ""
    },
    extensions: [
      { name: "CSeq", value: "2 INVITE" },
      { name: "X-Gateway-Auth", value: "dXNlcjpwYXNz" },
      { name: "Privacy", value: "id" }
    ],
    via: [
      {
        host: "10.0.0.2",
        port: 5060,
        transport: Transport.UDP,
        branch: "z9hG4bK-1",
        rPortFlag: true
      }
    ],
    route: [],
    recordRoute: []
  } as SIPMessage)

const request = (): MessageRequest => ({
  ref: "1-25@10.0.0.2",
  edgePortRef: "edgeport-01",
  method: Method.INVITE,
  sender: { host: "10.0.0.2", port: 5060, transport: Transport.UDP },
  listeningPoints: [],
  externalAddrs: ["10.0.1.1"],
  localnets: ["10.0.0.0/24"],
  message: message()
})

const record = (): TraceRecord => ({
  traceVersion: 1,
  recordedAt: "2026-10-23T02:41:10.321Z",
  callId: "1-25@10.0.0.2",
  seq: 1,
  tOffsetMs: 0,
  kind: TraceKind.REQUEST,
  method: "INVITE",
  edgePort: { ref: "edgeport-01", version: "2.17.0" },
  dispatcher: { ref: "message-dispatcher", version: "2.17.0" },
  request: request(),
  hops: [
    {
      component: "connect-processor",
      kind: HopKind.PROCESSOR,
      durationMs: 11.8,
      action: HopAction.FORWARDED,
      diff: { headers: { added: {}, removed: {}, changed: {} } }
    }
  ],
  response: { message: message() },
  outcome: TraceOutcome.FORWARDED,
  totalMs: 15.9
})

describe("@routr/common/trace", () => {
  describe("validate", () => {
    it("accepts a well formed record", () => {
      expect(validateRecord(record())).to.have.property("seq", 1)
    })

    it("rejects a version it cannot read before looking at fields", () => {
      const future = { ...record(), traceVersion: 2, newField: true }
      expect(() => validateRecord(future, 3))
        .to.throw(UnsupportedTraceVersionError)
        .with.property("message")
        .that.includes("line 3: trace version 2 is not supported")
    })

    it("rejects a record without a version", () => {
      const { traceVersion, ...rest } = record()
      expect(traceVersion).to.equal(1)
      expect(() => validateRecord(rest)).to.throw(UnsupportedTraceVersionError)
    })

    it("names the offending field", () => {
      const bad = { ...record(), outcome: "lost" }
      expect(() => validateRecord(bad, 2))
        .to.throw(TraceValidationError)
        .with.property("message")
        .that.includes("/outcome")
    })

    it("rejects unknown envelope fields", () => {
      const bad = { ...record(), extra: 1 }
      expect(() => validateRecord(bad)).to.throw(TraceValidationError)
    })

    it("parses a file and reports a truncated last line", () => {
      const good = JSON.stringify(record())
      expect(parseTrace(`${good}\n\n${good}\n`)).to.have.length(2)
      expect(() => parseTrace(`${good}\n${good.slice(0, 40)}`))
        .to.throw(TraceValidationError)
        .with.property("line", 2)
    })

    it("rejects a line that is not an object", () => {
      expect(() => parseTrace("[1,2]")).to.throw("record is not a JSON object")
    })
  })

  describe("redact", () => {
    it("removes credentials and keeps the rest", () => {
      const redacted = redactRequest(request())
      expect(redacted.message.authorization.response).to.equal(REDACTED)
      expect(redacted.message.authorization.cNonce).to.equal(REDACTED)
      expect(redacted.message.authorization.nonce).to.equal("abc")
      expect(redacted.message.authorization.username).to.equal("1001")
      const gw = redacted.message.extensions.find(
        (e: { name: string }) => e.name === "X-Gateway-Auth"
      )
      expect(gw.value).to.equal(REDACTED)
      expect(redacted.message.extensions[0].value).to.equal("2 INVITE")
    })

    it("does not touch the original", () => {
      const original = request()
      redactRequest(original)
      expect(original.message.authorization.response).to.equal("7a0c1b")
    })
  })

  describe("diff", () => {
    it("renders URIs as on the wire", () => {
      expect(
        formatUri({
          user: "+1555",
          host: "sip.provider.net",
          port: 7060,
          transportParam: Transport.UDP,
          userParam: "phone"
        })
      ).to.equal("sip:+1555@sip.provider.net:7060;transport=udp;user=phone")
    })

    it("flattens multi-valued headers in order", () => {
      const headers = flattenHeaders(message())
      expect(headers["Via"]).to.deep.equal([
        "SIP/2.0/UDP 10.0.0.2:5060;branch=z9hG4bK-1;rport"
      ])
      expect(headers["From"]).to.have.length(1)
      expect(headers["From"][0]).to.include("John Doe")
      expect(headers["From"][0]).to.include("<sip:1001@sip.local>;tag=1")
      expect(headers["Max-Forwards"]).to.deep.equal(["70"])
    })

    it("reports added, removed and changed headers and the request URI", () => {
      const before = message()
      const after = message()
      after.requestUri = { user: "17853178070", host: "sip.provider.net" }
      after.maxForwards = { maxForwards: 69 }
      after.via.unshift({
        host: "10.0.1.1",
        port: 5060,
        transport: Transport.UDP,
        branch: "z9hG4bK-2"
      })
      after.extensions = after.extensions
        .filter((e) => e.name !== "Privacy")
        .concat({ name: "P-Asserted-Identity", value: "<sip:+1@x;user=phone>" })
      delete after.authorization

      const diff = diffMessages(before, after)
      expect(diff.requestUri).to.deep.equal({
        from: "sip:17853178070@sip.local",
        to: "sip:17853178070@sip.provider.net"
      })
      expect(diff.headers.added).to.have.keys(["P-Asserted-Identity"])
      expect(diff.headers.removed).to.have.keys(["Privacy", "Authorization"])
      expect(diff.headers.changed["Max-Forwards"]).to.deep.equal({
        from: "70",
        to: "69"
      })
      expect(diff.headers.changed["Via"].to).to.include("z9hG4bK-2")
      expect(isEmptyDiff(diff)).to.equal(false)
      expect(isEmptyDiff(diffMessages(before, message()))).to.equal(true)
    })
  })

  describe("status", () => {
    it("maps response types to codes and phrases", () => {
      expect(statusCodeOf(ResponseType.RINGING)).to.equal(180)
      expect(
        statusCodeOf(ResponseType.CALL_OR_TRANSACTION_DOES_NOT_EXIST)
      ).to.equal(481)
      expect(statusCodeOf("NOPE")).to.equal(undefined)
      expect(reasonPhraseOf(ResponseType.SESSION_PROGRESS)).to.equal(
        "session progress"
      )
    })
  })
})

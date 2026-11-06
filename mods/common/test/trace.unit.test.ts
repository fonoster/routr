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
import { readdirSync, readFileSync } from "fs"
import { join } from "path"
import { load as parseYaml } from "js-yaml"
import chai from "chai"
import {
  credentialsFromResources,
  diffMessages,
  flattenHeaders,
  formatUri,
  HopAction,
  HopKind,
  isEmptyDiff,
  parseTrace,
  Profile,
  reasonPhraseOf,
  REDACTED,
  redactRequest,
  Rules,
  sanitizeTrace,
  statusCodeOf,
  SurvivingValueError,
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
import { calculateAuthResponse } from "../src/auth"
import {
  decodeIdentity,
  decodeIdentityUser,
  encodeIdentity,
  encodeIdentityUser
} from "../src/identity"
import { ValidationError } from "../src/validation_error"

const expect = chai.expect

const q = (text: string) => `"${text}"`

const SDP = [
  "v=0",
  "o=alice 2890844526 2890844527 IN IP4 198.51.100.7",
  "s=Alice call",
  "c=IN IP4 198.51.100.7",
  "t=0 0",
  "m=audio 49170 RTP/SAVPF 8",
  "a=rtpmap:8 PCMA/8000",
  "a=ice-ufrag:ufragvalue",
  "a=ice-pwd:icepasswordvalue",
  "a=candidate:842163049 1 udp 1677729535 198.51.100.7 49170 typ srflx raddr 192.168.1.9 rport 49170",
  "a=fingerprint:sha-256 AB:CD:EF:01:23:45",
  "a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:cryptokeyvalue",
  "a=ssrc:3735928559 cname:cnamevalue",
  "a=msid:msidstream msidtrack"
].join("\r\n")

// A call as a real stack records it, full of values that must not be published
const privateRecord = (): TraceRecord => {
  const r = record()
  const m = r.request.message
  r.callId = "call-id-value@198.51.100.7"
  r.trunkRef = "trunk-acme"
  r.request.ref = "call-id-value@198.51.100.7"
  r.request.sender.host = "198.51.100.7"
  r.request.externalAddrs = ["198.51.100.1"]
  r.request.localnets = ["192.168.1.9/24"]
  m.callId = { callId: "call-id-value@198.51.100.7" }
  m.requestUri = { user: "+13055550100", host: "sip.acme.example" } as never
  m.from.address = {
    displayName: "Maria Example",
    uri: { user: "maria.example", host: "sip.acme.example" }
  } as never
  m.from.tag = "fromtagvalue"
  m.to.address.uri = { user: "13055550100", host: "wa.meta.vc" } as never
  m.via[0].host = "198.51.100.7"
  m.via[0].branch = "z9hG4bKbranchvalue"
  m.contact.address.uri = {
    user: "maria.example",
    host: "198.51.100.7"
  } as never
  m.authorization = {
    ...m.authorization,
    realm: "sip.acme.example",
    nonce: "noncevalue",
    cNonce: "cnoncevalue",
    uri: "sip:+13055550100@sip.acme.example",
    method: "INVITE"
  } as never
  m.body = SDP
  m.extensions = [
    { name: "CSeq", value: "2 INVITE" },
    { name: "User-Agent", value: "Zoiper 5.6" },
    { name: "X-Corp-Id", value: "87156754" },
    { name: "X-Twilio-CallSid", value: "CAdeadbeefvalue" },
    { name: "X-External-Domain", value: "wa.meta.vc" },
    {
      name: "P-Asserted-Identity",
      value: `${q(
        "Maria Example"
      )} <sip:+13055550100@sip.acme.example;user=phone>`
    },
    {
      name: "Remote-Party-ID",
      value: "<sip:+13055550100@sip.acme.example>;party=calling"
    },
    {
      name: "Diversion",
      value: "Juan Example <sip:+13055550111@sip.acme.example>;reason=busy"
    }
  ]
  m.recordRoute = [
    {
      address: {
        uri: { host: "198.51.100.1", lrParam: true }
      },
      parameters: {
        rfo: encodeIdentity({
          user: "+13055550100",
          host: "sip.acme.example"
        } as never)
      }
    }
  ] as never
  r.hops[0].diff = {
    requestUri: {
      from: "sip:+13055550100@sip.acme.example",
      to: "sip:+13055550100@198.51.100.1:5060"
    },
    headers: {
      added: {
        "X-Corp-Id": "87156754",
        Body: "m=audio 49170 RTP/SAVPF 8 c=IN IP4 198.51.100.7"
      },
      removed: {
        // A name only this hop's diff ever shows
        From: `${q(
          "Rosa Hidden"
        )} <sip:maria.example@sip.acme.example>;tag=fromtagvalue`,
        Authorization: `Digest username=${q("1001")}, realm=${q(
          "sip.acme.example"
        )}`
      },
      changed: {
        Via: {
          from: "SIP/2.0/UDP 198.51.100.7:5060;branch=z9hG4bKbranchvalue",
          to: "SIP/2.0/UDP 198.51.100.1:5060;branch=z9hG4bKother;received=198.51.100.7"
        }
      }
    }
  }
  r.response = null
  return r
}

const credentials = [{ username: "1001", password: "1234" }]

const PRIVATE_VALUES = [
  "13055550100",
  "13055550111",
  "87156754",
  "Maria Example",
  "Juan Example",
  "Rosa Hidden",
  "CAdeadbeefvalue",
  "198.51.100.7",
  "198.51.100.1",
  "192.168.1.9",
  "sip.acme.example",
  "maria.example",
  "call-id-value",
  "trunk-acme",
  "fromtagvalue",
  "branchvalue",
  "noncevalue",
  "cnoncevalue",
  "2890844526",
  "Alice call",
  "ufragvalue",
  "icepasswordvalue",
  "842163049",
  "AB:CD:EF:01:23:45",
  "cryptokeyvalue",
  "3735928559",
  "cnamevalue",
  "msidstream",
  encodeIdentity({ user: "+13055550100", host: "sip.acme.example" } as never)
]

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

  describe("sanitizeTrace", () => {
    const CORPUS = join(__dirname, "../../../etc/corpus")

    it("replaces every identifier when no rewrite is given", () => {
      const out = JSON.stringify(
        sanitizeTrace([privateRecord()], {
          credentials,
          keepHosts: ["wa.meta.vc"]
        })
      )
      PRIVATE_VALUES.forEach((value) => expect(out).to.not.include(value))
      expect(out).to.match(/\+1555555\d{4}/)
      expect(out).to.match(/203\.0\.113\.\d+/)
      expect(out).to.match(/10\.0\.0\.\d+/)
      expect(out).to.match(/[\w-]+\.invalid/)
    })

    it("keeps protocol structure", () => {
      const [out] = sanitizeTrace([privateRecord()], { credentials })
      const m = out.request.message
      expect(out.method).to.equal("INVITE")
      expect(out.outcome).to.equal("forwarded")
      expect(out.recordedAt).to.equal("2026-10-23T02:41:10.321Z")
      expect(m.via[0].transport).to.equal("UDP")
      expect(m.via[0].branch).to.match(/^z9hG4bK/)
      expect(m.authorization.algorithm).to.equal("MD5")
      expect(m.authorization.qop).to.equal("auth")
      const header = (name: string) =>
        m.extensions.find((e: { name: string }) => e.name === name).value
      expect(header("CSeq")).to.equal("2 INVITE")
      expect(header("User-Agent")).to.equal("Zoiper 5.6")
      expect(m.body).to.include("m=audio 49170 RTP/SAVPF 8")
      expect(m.body).to.include("a=rtpmap:8 PCMA/8000")
      expect(m.body).to.include("a=fingerprint:sha-256 ")
      expect(m.body).to.include("\r\n")
    })

    it("gives a value the same fake across the file", () => {
      const second = privateRecord()
      second.seq = 2
      const [a, b] = sanitizeTrace([privateRecord(), second], { credentials })
      expect(a.callId).to.equal(b.callId)
      expect(a.callId).to.equal(a.request.ref)
      expect(a.callId).to.equal(a.request.message.callId.callId)
      expect(a.request.message.requestUri.user).to.equal(
        b.request.message.requestUri.user
      )
      // The same number with and without its +
      expect(a.request.message.requestUri.user).to.equal(
        a.request.message.to.address.uri.user
      )
      expect(a.request.message.requestUri.host).to.equal(
        a.request.message.from.address.uri.host
      )
      expect(a.request.sender.host).to.equal(a.request.message.via[0].host)
    })

    it("never hands out a fake that is also an input value", () => {
      const r = privateRecord()
      r.request.message.via[0].host = "10.0.0.1"
      r.request.sender.host = "10.0.0.2"
      r.request.message.to.address.uri.user = "+15555550001"
      const out = JSON.stringify(sanitizeTrace([r], { credentials }))
      expect(out).to.not.match(/10\.0\.0\.[12]\b/)
      expect(out).to.not.include("15555550001")
    })

    it("keeps a host and an address listed with keepHosts", () => {
      const [out] = sanitizeTrace([privateRecord()], {
        credentials,
        keepHosts: ["wa.meta.vc", "198.51.100.1"]
      })
      const m = out.request.message
      expect(m.to.address.uri.host).to.equal("wa.meta.vc")
      expect(
        m.extensions.find(
          (e: { name: string }) => e.name === "X-External-Domain"
        ).value
      ).to.equal("wa.meta.vc")
      expect(out.request.externalAddrs).to.deep.equal(["198.51.100.1"])
      expect(m.from.address.uri.host).to.match(/\.invalid$/)
    })

    it("uses a rewrite as the fake of a value", () => {
      const [out] = sanitizeTrace([privateRecord()], {
        credentials,
        rewrites: [["+13055550100", "+15555550199"]]
      })
      expect(out.request.message.requestUri.user).to.equal("+15555550199")
    })

    it("recomputes the digest over the replaced values", () => {
      const [out] = sanitizeTrace([privateRecord()], { credentials })
      const auth = out.request.message.authorization
      expect(auth.username).to.equal("1001")
      expect(auth.nonce).to.not.equal("noncevalue")
      expect(auth.response).to.equal(
        calculateAuthResponse({ ...auth, method: Method.INVITE } as never, {
          username: "1001",
          secret: "1234"
        })
      )
      expect(() =>
        sanitizeTrace([privateRecord()], { credentials: [] })
      ).to.throw("no credential for digest username")
    })

    it("fails naming the field, never the value, when one survives", () => {
      const r = privateRecord()
      r.request.message.extensions[1].value = "Zoiper 13055550100"
      const run = () => sanitizeTrace([r], { credentials })
      expect(run).to.throw(SurvivingValueError)
      expect(run)
        .to.throw(
          "seq 1 request.message.extensions[1].value still holds an input value"
        )
        .with.property("message")
        .that.does.not.include("13055550100")
    })

    // Runs one raw header through the file, as an extension and in a hop's diff
    const sanitizeHeader = (
      name: string,
      value: string,
      options: { keepHosts?: string[] } = {}
    ) => {
      const r = record()
      r.request.message.extensions = [{ name, value }]
      r.hops[0].diff = {
        headers: { added: { [name]: value }, removed: {}, changed: {} }
      }
      const [out] = sanitizeTrace([r], { credentials, ...options })
      const added = out.hops[0].diff.headers.added
      expect(added[Object.keys(added)[0]]).to.equal(
        out.request.message.extensions[0].value
      )
      return out.request.message.extensions[0].value
    }

    it("replaces a quoted name with escaped quotes in a raw header", () => {
      const value = sanitizeHeader(
        "P-Asserted-Identity",
        `${q(
          "Janet \\" + q("JD\\") + " Doeson"
        )} <sip:+15550001234@carrier.example.com>`
      )
      expect(value).to.not.match(/Janet|JD|Doeson/)
      expect(value).to.match(/^"Caller \d+" <sip:\+1555555\d{4}@host-\d+/)
    })

    it("replaces a quoted parameter value in a raw header", () => {
      const value = sanitizeHeader(
        "Remote-Party-ID",
        `<sip:+15550001234@carrier.example.com>;name=${q("Janet Doeson")}`
      )
      expect(value).to.not.match(/Janet|Doeson/)
      expect(value).to.match(/;name="fake-\d+"$/)
    })

    it("replaces every parameter value that is not protocol", () => {
      const inUri = sanitizeHeader(
        "Diversion",
        "<sip:+15550001234@carrier.example.com;tgrp=janetdoeson-pbx>;reason=busy;counter=1"
      )
      expect(inUri).to.not.include("janetdoeson")
      expect(inUri).to.match(/;tgrp=fake-\d+>;reason=busy;counter=1$/)
      const outside = sanitizeHeader(
        "P-Asserted-Identity",
        "<sip:a@b.example.com>;cn=JaneDoe;x-acct=ACME42"
      )
      expect(outside).to.not.match(/JaneDoe|ACME42/)
    })

    it("replaces a parameter in a hop's request URI", () => {
      const r = record()
      r.hops[0].diff = {
        requestUri: {
          from: "sip:+15550001234@carrier.example.com;tgrp=janetdoeson-pbx",
          to: "sip:+15550001234@carrier.example.com"
        },
        headers: { added: {}, removed: {}, changed: {} }
      }
      const out = JSON.stringify(sanitizeTrace([r], { credentials }))
      expect(out).to.not.include("janetdoeson")
    })

    it("replaces a user that holds parameters and a URI's headers", () => {
      const user = sanitizeHeader(
        "P-Asserted-Identity",
        "<sip:+15550001234;cpc=janetdoeson@carrier.example.com>"
      )
      expect(user).to.not.match(/15550001234|janetdoeson|carrier/)
      const query = sanitizeHeader(
        "Refer-To",
        "<sip:carrier.example.com;transport=tcp?Replaces=janetdoeson-call>"
      )
      expect(query).to.not.include("janetdoeson")
      expect(query).to.include(";transport=tcp?")
    })

    it("keeps protocol parameters and the parameters of an SDP", () => {
      const value = sanitizeHeader(
        "Remote-Party-ID",
        "<sip:a@b.example.com;user=phone;lr;r2=on>;party=calling;screen=yes;privacy=off"
      )
      expect(value).to.match(
        /;user=phone;lr;r2=on>;party=calling;screen=yes;privacy=off$/
      )
      const r = record()
      r.request.message.body =
        "v=0\r\na=fmtp:111 minptime=10;useinbandfec=1\r\n"
      const [out] = sanitizeTrace([r], { credentials })
      expect(out.request.message.body).to.include(
        "a=fmtp:111 minptime=10;useinbandfec=1"
      )
    })

    it("replaces a hop's error, ref included, as one value", () => {
      const r = record()
      r.hops[0].error =
        "no trunk associated with Number ref: number-15550003333"
      const [out] = sanitizeTrace([r], { credentials })
      expect(out.hops[0].error).to.match(/^fake-\d+$/)
    })

    it("gets past a product name in the SDP with a pin", () => {
      const r = record()
      r.request.message.body = "v=0\r\ns=Asterisk\r\n"
      r.request.message.extensions = [
        { name: "User-Agent", value: "Asterisk PBX 20.5.0" }
      ]
      expect(() => sanitizeTrace([r], { credentials })).to.throw(
        SurvivingValueError
      )
      const [out] = sanitizeTrace([r], {
        credentials,
        rewrites: [["Asterisk", "Asterisk"]]
      })
      expect(out.request.message.body).to.include("s=Asterisk")
    })

    describe("an IPv6 address", () => {
      const ipv6Record = () => {
        const r = record()
        r.request.sender.host = "2001:db8::7"
        r.request.message.body = "v=0\r\nc=IN IP6 2001:DB8::7\r\n"
        r.request.message.extensions = [
          { name: "X-Via", value: "SIP/2.0/UDP [2001:db8::7]:5060" },
          { name: "Contact", value: "<sip:[2001:db8::7]:5060>" }
        ]
        r.request.externalAddrs = ["[2001:db8::7]:5060"]
        return r
      }

      it("gets one fake, with or without its brackets", () => {
        const [out] = sanitizeTrace([ipv6Record()], { credentials })
        const m = out.request.message
        const fake = out.request.sender.host
        expect(fake).to.match(/^203\.0\.113\.\d+$/)
        expect(m.body).to.include(`c=IN IP4 ${fake}`)
        expect(m.extensions[1].value).to.equal(`<sip:${fake}:5060>`)
        expect(out.request.externalAddrs).to.deep.equal([`${fake}:5060`])
      })

      it("stays when listed with keepHosts", () => {
        const [out] = sanitizeTrace([ipv6Record()], {
          credentials,
          keepHosts: ["2001:db8::7"]
        })
        const m = out.request.message
        expect(out.request.sender.host).to.equal("2001:db8::7")
        expect(m.body).to.include("c=IN IP6 2001:DB8::7")
        expect(m.extensions[1].value).to.equal("<sip:[2001:db8::7]:5060>")
      })
    })

    describe("a finding's message", () => {
      const withFinding = (user: string, host: string, message: string) => {
        const r = record()
        r.response.message.from.address.uri = { user, host } as never
        r.findings = [
          {
            rule: "sip-connect/from-e164-or-anonymous",
            profile: "sip-connect",
            severity: "warning",
            spec: "SIPconnect 1.1",
            message,
            side: "out",
            header: "From"
          }
        ] as never
        return r
      }

      it("loses a short SIP user, under the fake of that user", () => {
        const [out] = sanitizeTrace(
          [
            withFinding(
              "ana",
              "sip.local",
              "From user ana is neither E.164 nor anonymous"
            )
          ],
          { credentials }
        )
        const fake = out.response.message.from.address.uri.user
        expect(fake).to.match(/^user-\d+$/)
        expect(out.findings[0].message).to.equal(
          `From user ${fake} is neither E.164 nor anonymous`
        )
      })

      it("loses a short host, under the fake of that host", () => {
        const [out] = sanitizeTrace(
          [
            withFinding(
              "1001",
              "pbx",
              "Contact names pbx, an internal address the far side cannot reach"
            )
          ],
          { credentials }
        )
        const fake = out.response.message.from.address.uri.host
        expect(fake).to.match(/\.invalid$/)
        expect(out.findings[0].message).to.equal(
          `Contact names ${fake}, an internal address the far side cannot reach`
        )
      })
    })

    describe("text the address patterns don't recognize", () => {
      const NAMES = /ali88|Alice|Jones/

      it("goes after a space that follows a semicolon", () => {
        const value = sanitizeHeader(
          "Diversion",
          "<tel:+15555550123>; reason=unconditional; x-sub=ali88"
        )
        expect(value).to.not.match(NAMES)
        expect(value).to.match(/;reason=unconditional;x-sub=fake-\d+$/)
      })

      it("goes after the URI and its parameters", () => {
        const bare = sanitizeHeader(
          "X-Caller",
          "sip:a1@pbx.acme.example Alice Jones"
        )
        expect(bare).to.not.match(NAMES)
        expect(bare).to.match(/^sip:user-\d+@host-\d+\.invalid fake-\d+$/)
        const inParameter = sanitizeHeader(
          "X-Caller",
          "<sip:a1@pbx.acme.example>;name=Alice Jones"
        )
        expect(inParameter).to.not.match(NAMES)
      })

      it("goes inside the brackets and in a list", () => {
        ;[
          "<sip:a1@pbx.acme.example;name=Alice Jones>",
          "<sip:a1@pbx.acme.example;alice>;jones",
          "Alice, Jones <sip:a1@pbx.acme.example>",
          "<sip:a1@pbx.acme.example>, Alice Jones",
          "Alice;Jones <sip:a1@pbx.acme.example>",
          "sip:a1@pbx.acme.example:alice"
        ].forEach((header) => {
          expect(sanitizeHeader("P-Asserted-Identity", header)).to.not.match(
            /alice|jones/i
          )
        })
      })

      it("keeps every address of a well formed list", () => {
        const value = sanitizeHeader(
          "P-Asserted-Identity",
          `${q(
            "Alice, Jones"
          )} <sip:a1@pbx.acme.example;user=phone>;party=calling, <tel:+15555550123>`
        )
        expect(value).to.match(
          /^"Caller \d+" <sip:user-\d+@host-\d+\.invalid;user=phone>;party=calling, <tel:\+1555555\d{4}>$/
        )
      })

      it("goes from a value that only starts like a Via or a digest", () => {
        const via = sanitizeHeader(
          "X-Caller",
          "SIP/2.0/UDP pbx.acme.example:5060;rport Alice Jones"
        )
        expect(via).to.not.match(NAMES)
        expect(via).to.match(/^SIP\/2\.0\/UDP host-\d+\.invalid:5060;rport /)
        expect(sanitizeHeader("X-Caller", "Digest Alice Jones")).to.not.match(
          NAMES
        )
        const digest = sanitizeHeader(
          "X-Caller",
          `Digest username=ali88, realm=${q(
            "pbx.acme.example"
          )}, algorithm=MD5, x-sub=Alice`
        )
        expect(digest).to.not.match(NAMES)
        expect(digest).to.match(/algorithm=MD5/)
      })

      it("goes from a flag and from a protocol parameter's value", () => {
        ;[
          "<sip:a1@pbx.acme.example>;alice",
          "<sip:a1@pbx.acme.example>;reason=alice",
          `<sip:a1@pbx.acme.example>;reason=${q("alice")}`,
          "<sip:a1@pbx.acme.example;user=alice>",
          "<sip:a1@pbx.acme.example>; tag=alice",
          "<sip:a1@pbx.acme.example>; received=alice"
        ].forEach((header) => {
          expect(sanitizeHeader("Diversion", header)).to.not.include("alice")
        })
      })
    })

    describe("a caller ID withheld the RFC 3323 way", () => {
      const withheld = () => {
        const r = record()
        const from = {
          address: {
            displayName: "Anonymous",
            uri: { user: "anonymous", host: "anonymous.invalid" }
          },
          tag: "1"
        }
        r.request.message.from = from as never
        r.response.message.from = JSON.parse(JSON.stringify(from))
        r.hops[0].diff = {
          headers: {
            added: {
              From: `${q("Anonymous")} <sip:anonymous@anonymous.invalid>;tag=1`
            },
            removed: {},
            changed: {}
          }
        }
        r.findings = [
          {
            rule: "sip-connect/from-e164-or-anonymous",
            profile: "sip-connect",
            severity: "warning",
            spec: "SIPconnect 1.1",
            message: "a finding",
            side: "out"
          }
        ] as never
        return r
      }

      it("stays anonymous, with a finding that names the word", () => {
        const [out] = sanitizeTrace([withheld()], { credentials })
        const from = out.response.message.from.address
        expect(from.displayName).to.equal("Anonymous")
        expect(from.uri.user).to.equal("anonymous")
        expect(from.uri.host).to.equal("anonymous.invalid")
        expect(out.hops[0].diff.headers.added.From).to.equal(
          `${q("Anonymous")} <sip:anonymous@anonymous.invalid>;tag=${
            out.response.message.from.tag
          }`
        )
      })

      it("passes sip-connect/privacy's From check toward a provider", () => {
        const messages = (
          change: (r: TraceRecord) => void = () => undefined
        ) => {
          const r = withheld()
          r.response.message.via[0].host = "198.51.100.1"
          r.request.externalAddrs = ["198.51.100.1"]
          change(r)
          const [out] = sanitizeTrace([r], {
            credentials,
            keepHosts: ["198.51.100.1"]
          })
          return Rules.evaluate(out, [out], {
            profiles: [Profile.SIP_CONNECT]
          }).map((f) => f.message)
        }
        const NAMES_THE_CALLER =
          "Privacy: id requested but From still names the caller"
        expect(messages()).to.not.include(NAMES_THE_CALLER)
        // The rule does look at this record: a From that names someone fails it
        expect(
          messages((r) => {
            r.response.message.from.address.uri = {
              user: "ana",
              host: "sip.local"
            } as never
          })
        ).to.include(NAMES_THE_CALLER)
      })
    })

    describe("the identity parameters of a Record-Route", () => {
      const FROM = {
        user: "+13055550100",
        host: "sip.acme.example",
        port: 5061,
        userParam: "phone"
      }
      const TO = { user: "maria.example", host: "wa.acme.example" }
      const NEW_FROM = { user: "ana", host: "198.51.100.7" }
      const NEW_TO = { user: "13055550111", host: "[2001:db8::7]" }

      const identified = () => {
        const r = record()
        const m = r.request.message
        m.from.address.uri = { ...FROM } as never
        m.to.address.uri = { ...TO } as never
        r.response.message.from.address.uri = { ...NEW_FROM } as never
        r.response.message.to.address.uri = { ...NEW_TO } as never
        const parameters = {
          rfo: encodeIdentity(FROM as never),
          rfn: encodeIdentity(NEW_FROM as never),
          rco: encodeIdentity(TO as never),
          rcn: encodeIdentity(NEW_TO as never)
        }
        m.recordRoute = [
          {
            address: { uri: { host: "198.51.100.1", lrParam: true } },
            parameters
          }
        ] as never
        r.response.message.recordRoute = [
          {
            address: {
              uri: {
                user: encodeIdentityUser(parameters),
                host: "198.51.100.1",
                lrParam: true
              }
            }
          }
        ] as never
        r.hops[0].diff = {
          headers: {
            added: {
              "Record-Route": `<sip:198.51.100.1;lr;rfo=${parameters.rfo};rfn=${parameters.rfn};rco=${parameters.rco};rcn=${parameters.rcn}>`
            },
            removed: {},
            changed: {}
          }
        }
        return r
      }

      // What each parameter must read: the same user and host as the From or To
      const expectMatches = (
        values: Record<string, string>,
        out: TraceRecord
      ) => {
        const expected = {
          rfo: out.request.message.from.address.uri,
          rco: out.request.message.to.address.uri,
          rfn: out.response.message.from.address.uri,
          rcn: out.response.message.to.address.uri
        }
        Object.entries(expected).forEach(([name, uri]) => {
          const decoded = decodeIdentity(values[name])
          expect(decoded.user, name).to.equal(uri.user)
          expect(decoded.host, name).to.equal(uri.host)
        })
      }

      it("decode to the sanitized From and To, in parameters", () => {
        const [out] = sanitizeTrace([identified()], { credentials })
        const { parameters } = out.request.message.recordRoute[0]
        expectMatches(parameters as Record<string, string>, out)
        const rfo = decodeIdentity((parameters as Record<string, string>).rfo)
        expect(rfo.port).to.equal(5061)
        expect(rfo.userParam).to.equal("phone")
      })

      it("decode to the sanitized From and To, in the URI user part", () => {
        const [out] = sanitizeTrace([identified()], { credentials })
        const user = out.response.message.recordRoute[0].address.uri.user
        expectMatches(decodeIdentityUser(user), out)
      })

      it("decode to the sanitized From and To, in a raw header", () => {
        const [out] = sanitizeTrace([identified()], { credentials })
        const raw = out.hops[0].diff.headers.added["Record-Route"]
        const values = Object.fromEntries(
          [...raw.matchAll(/;(rfo|rfn|rco|rcn)=([\w-]+)/g)].map((m) => [
            m[1],
            m[2]
          ])
        )
        expectMatches(values, out)
        expect(raw).to.match(/^<sip:203\.0\.113\.\d+;lr;rfo=/)
      })

      it("follow a rewrite of the From user", () => {
        const [out] = sanitizeTrace([identified()], {
          credentials,
          rewrites: [["+13055550100", "+15555550199"]]
        })
        const { parameters } = out.request.message.recordRoute[0]
        expect(out.request.message.from.address.uri.user).to.equal(
          "+15555550199"
        )
        expectMatches(parameters as Record<string, string>, out)
      })

      it("hold no parameter the encoder doesn't write", () => {
        const r = identified()
        const hidden = Buffer.from(
          "1001@sip.local;user=phone;x-sub=ali88;name=Alice Jones;bob"
        ).toString("base64url")
        r.request.message.recordRoute[0].parameters = { rfo: hidden } as never
        const [out] = sanitizeTrace([r], { credentials })
        const decoded = Buffer.from(
          (out.request.message.recordRoute[0].parameters as never)["rfo"],
          "base64url"
        ).toString("utf8")
        expect(decoded).to.not.match(/ali88|Alice|Jones|bob/)
        expect(decoded).to.include(";user=phone")
      })
    })

    it("sanitizes every corpus file into one validate accepts", () => {
      const resources = parseYaml(
        readFileSync(join(CORPUS, "resources/credentials.yaml"), "utf8")
      )
      const files = readdirSync(CORPUS).filter((f) => f.endsWith(".jsonl"))
      expect(files).to.not.have.length(0)
      files.forEach((file) => {
        const records = parseTrace(readFileSync(join(CORPUS, file), "utf8"))
        const out = sanitizeTrace(records, {
          credentials: credentialsFromResources(resources)
        })
        const text = out.map((r) => JSON.stringify(r)).join("\n")
        expect(parseTrace(text), file).to.have.length(records.length)
        expect(text, file).to.not.include("sip.local")
      })
    })

    it("rejects invalid options", () => {
      expect(() =>
        sanitizeTrace([], { credentials: [], keepHosts: [1] } as never)
      ).to.throw(ValidationError)
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

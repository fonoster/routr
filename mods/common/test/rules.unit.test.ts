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
import { readFileSync } from "fs"
import { join } from "path"
import { Trace } from "../src"
import { SIPMessage } from "../src/types"

const expect = chai.expect
// Wraps a value in double quotes without tripping the quotes lint rule
const q = (v: string) => `"${v}"`

// A real recording: 401 challenge, forwarded INVITE (seq 2) and its
// retransmission (seq 3), 180/200, ACK, re-INVITE, 200, ACK, BYE, 200.
const FIXTURE = Trace.parseTrace(
  readFileSync(join(__dirname, "fixtures", "call.jsonl"), "utf8")
)

const bySeq = (seq: number): Trace.TraceRecord =>
  JSON.parse(JSON.stringify(FIXTURE.find((r) => r.seq === seq)))

const mutate = (
  r: Trace.TraceRecord,
  fn: (inMsg: SIPMessage, out: SIPMessage, r: Trace.TraceRecord) => void
): Trace.TraceRecord => {
  const copy: Trace.TraceRecord = JSON.parse(JSON.stringify(r))
  fn(copy.request.message, copy.response?.message as SIPMessage, copy)
  return copy
}

const ext = (m: SIPMessage, name: string, value: string) =>
  m.extensions.push({ name, value })

const setExt = (m: SIPMessage, name: string, values: string[]) => {
  m.extensions = m.extensions.filter(
    (e) => e.name.toLowerCase() !== name.toLowerCase()
  )
  values.forEach((v) => ext(m, name, v))
}

const base = bySeq(2)
const EXTERNAL = base.request.externalAddrs[0]
const INTERNAL = base.request.listeningPoints[0].host

interface Case {
  rule: string
  hit: { record: Trace.TraceRecord; call?: Trace.TraceRecord[] }
  miss: { record: Trace.TraceRecord; call?: Trace.TraceRecord[] }
}

const forwardedInvite = bySeq(2)
const relayed180 = bySeq(4)
const ok200 = bySeq(5)
const ack = bySeq(6)
const reInvite = bySeq(7)
const bye = bySeq(10)

const registerOk = mutate(bySeq(1), (inMsg, out, r) => {
  r.method = "REGISTER"
  r.outcome = Trace.TraceOutcome.ANSWERED
  r.status = 200
  inMsg.requestUri = { user: undefined, host: "sip.local" }
  inMsg.expires = { expires: 3600 }
  setExt(inMsg, "CSeq", ["1 REGISTER"])
  out.responseType = "OK" as never
  out.contact = inMsg.contact
  out.expires = { expires: 3600 }
})

const cancel = mutate(bySeq(2), (inMsg, out, r) => {
  r.method = "CANCEL"
  setExt(inMsg, "CSeq", ["2 CANCEL"])
  setExt(out, "CSeq", ["2 CANCEL"])
})

const CASES: Case[] = [
  {
    rule: "sip/max-forwards",
    hit: {
      record: mutate(forwardedInvite, (_, out) => {
        out.maxForwards = { maxForwards: 70 }
      })
    },
    miss: { record: forwardedInvite }
  },
  {
    rule: "sip/via",
    hit: {
      record: mutate(relayed180, (inMsg, out) => {
        out.via = inMsg.via
      })
    },
    miss: { record: relayed180 }
  },
  {
    rule: "sip/record-route-self",
    hit: {
      record: mutate(forwardedInvite, (_, out) => {
        out.recordRoute[0].address.uri.host = "203.0.113.9"
      })
    },
    miss: {
      record: mutate(forwardedInvite, (_, out) => {
        out.recordRoute[0].address.uri.host = EXTERNAL
      })
    }
  },
  {
    rule: "sip/route-self-removed",
    hit: {
      record: mutate(forwardedInvite, (_, out) => {
        out.route = [{ address: { uri: { host: INTERNAL, port: 5060 } } }]
      })
    },
    miss: { record: forwardedInvite }
  },
  {
    rule: "sip/credentials-stripped",
    hit: {
      record: mutate(forwardedInvite, (inMsg, out) => {
        inMsg.authorization = out.authorization = {
          username: "1001",
          realm: "sip.local",
          response: "abc"
        } as never
      })
    },
    miss: {
      record: mutate(forwardedInvite, (inMsg, out) => {
        inMsg.authorization = { username: "1001", realm: "sip.local" } as never
        delete out.authorization
      })
    }
  },
  {
    rule: "sip/private-address",
    hit: {
      record: mutate(forwardedInvite, (_, out) => {
        out.via[0].host = EXTERNAL
        out.contact.address.uri.host = INTERNAL
      })
    },
    miss: {
      record: mutate(forwardedInvite, (_, out) => {
        out.via[0].host = EXTERNAL
        out.contact.address.uri.host = "203.0.113.9"
        out.body = "v=0\r\nc=IN IP4 203.0.113.9\r\nm=audio 6000 RTP/AVP 0\r\n"
      })
    }
  },
  {
    rule: "sip/register-ok",
    hit: {
      record: mutate(registerOk, (inMsg, out) => {
        delete out.contact
        delete out.expires
        delete inMsg.expires
      })
    },
    miss: { record: registerOk }
  },
  {
    rule: "sip/cseq-ack",
    hit: {
      record: mutate(ack, (inMsg) => setExt(inMsg, "CSeq", ["99 ACK"])),
      call: [forwardedInvite]
    },
    miss: { record: ack, call: [forwardedInvite, ok200] }
  },
  {
    rule: "sip/cseq-monotonic",
    hit: {
      record: mutate(reInvite, (inMsg) => {
        inMsg.from = forwardedInvite.request.message.from
        setExt(inMsg, "CSeq", ["1 INVITE"])
        inMsg.via[0].branch = "z9hG4bK-other"
      }),
      call: [forwardedInvite]
    },
    miss: {
      record: mutate(reInvite, (inMsg) => {
        inMsg.from = forwardedInvite.request.message.from
        setExt(inMsg, "CSeq", ["3 INVITE"])
        inMsg.via[0].branch = "z9hG4bK-other"
      }),
      call: [forwardedInvite]
    }
  },
  {
    rule: "sip/cancel-matches",
    hit: {
      record: mutate(cancel, (inMsg) => {
        inMsg.via[0].branch = "z9hG4bK-nomatch"
      }),
      call: [forwardedInvite]
    },
    miss: { record: cancel, call: [forwardedInvite] }
  },
  {
    rule: "sip/ack-2xx",
    hit: { record: bye, call: [forwardedInvite, ok200] },
    miss: { record: bye, call: [forwardedInvite, ok200, ack] }
  },
  {
    rule: "sip/retransmission",
    hit: { record: bySeq(3), call: [forwardedInvite] },
    miss: { record: forwardedInvite, call: [] }
  },
  {
    rule: "sip-connect/pai-single",
    hit: {
      record: mutate(forwardedInvite, (_, out) => {
        out.via[0].host = EXTERNAL
        setExt(out, "P-Asserted-Identity", [
          "<sip:+17066041487@sip.local;user=phone>",
          "<sip:+17066041487@sip.local;user=phone>"
        ])
      })
    },
    miss: {
      record: mutate(forwardedInvite, (_, out) => {
        out.via[0].host = EXTERNAL
        setExt(out, "P-Asserted-Identity", [
          "<sip:+17066041487@sip.local;user=phone>"
        ])
      })
    }
  },
  {
    rule: "sip-connect/pai-e164",
    hit: {
      record: mutate(forwardedInvite, (_, out) => {
        out.via[0].host = EXTERNAL
        setExt(out, "P-Asserted-Identity", ["<sip:1001@sip.local>"])
      })
    },
    miss: {
      record: mutate(forwardedInvite, (_, out) => {
        out.via[0].host = EXTERNAL
        setExt(out, "P-Asserted-Identity", [
          `${q("1001")} <sip:+17066041487@sip.local;user=phone>`
        ])
      })
    }
  },
  {
    rule: "sip-connect/request-uri-e164",
    hit: {
      record: mutate(forwardedInvite, (_, out) => {
        out.via[0].host = EXTERNAL
        out.requestUri = { user: "17853178070", host: "sip.provider.net" }
      })
    },
    miss: {
      record: mutate(forwardedInvite, (_, out) => {
        out.via[0].host = EXTERNAL
        out.requestUri = {
          user: "+17853178070",
          host: "sip.provider.net",
          userParam: "phone"
        }
      })
    }
  },
  {
    rule: "sip-connect/from-e164-or-anonymous",
    hit: {
      record: mutate(forwardedInvite, (_, out) => {
        out.via[0].host = EXTERNAL
        out.from.address.uri.user = "1001"
      })
    },
    miss: {
      record: mutate(forwardedInvite, (_, out) => {
        out.via[0].host = EXTERNAL
        out.from.address.uri.user = "anonymous"
        out.from.address.uri.host = "anonymous.invalid"
      })
    }
  },
  {
    rule: "sip-connect/privacy",
    hit: {
      record: mutate(forwardedInvite, (_, out) => {
        out.via[0].host = EXTERNAL
        setExt(out, "Privacy", ["id"])
        out.from.address.uri.user = "1001"
      })
    },
    miss: {
      record: mutate(forwardedInvite, (_, out) => {
        out.via[0].host = EXTERNAL
        setExt(out, "Privacy", ["id"])
        setExt(out, "P-Asserted-Identity", [
          "<sip:+17066041487@sip.local;user=phone>"
        ])
        out.from.address.uri.user = "anonymous"
        out.from.address.uri.host = "anonymous.invalid"
      })
    }
  }
]

const ALL = [Trace.Profile.SIP, Trace.Profile.SIP_CONNECT]

const findingsOf = (
  rule: string,
  c: { record: Trace.TraceRecord; call?: Trace.TraceRecord[] }
) =>
  Trace.Rules.evaluate(c.record, c.call ?? [], { profiles: ALL }).filter(
    (f) => f.rule === rule
  )

describe("@routr/common/trace/rules", () => {
  it("has a firing and a non-firing case for every rule", () => {
    const covered = CASES.map((c) => c.rule).sort()
    expect(covered).to.deep.equal(Trace.Rules.RULES.map((r) => r.id).sort())
  })

  CASES.forEach(({ rule, hit, miss }) => {
    it(`${rule} fires on the violation and not on the compliant message`, () => {
      const fired = findingsOf(rule, hit)
      expect(fired, `${rule} should fire`).to.have.lengthOf.at.least(1)
      const f = fired[0]
      expect(f.rule).to.equal(rule)
      expect(f.spec).to.be.a("string").and.not.empty
      expect(f.message).to.be.a("string").and.not.empty
      expect(["in", "out", "call"]).to.include(f.side)
      expect(findingsOf(rule, miss), `${rule} should not fire`).to.deep.equal(
        []
      )
    })
  })

  it("every rule declares its profile, severity, spec and summary", () => {
    Trace.Rules.RULES.forEach((r) => {
      expect(r.id).to.match(/^(sip|sip-connect)\/[a-z0-9-]+$/)
      expect(r.id.startsWith(r.profile + "/")).to.equal(true)
      expect(Object.values(Trace.Severity)).to.include(r.severity)
      expect(r.spec).to.not.be.empty
      expect(r.summary).to.not.be.empty
    })
  })

  it("evaluates only the requested profiles", () => {
    const record = mutate(forwardedInvite, (_, out) => {
      out.via[0].host = EXTERNAL
      out.maxForwards = { maxForwards: 70 }
      setExt(out, "P-Asserted-Identity", [])
    })
    const sipOnly = Trace.Rules.evaluate(record, [])
    expect(sipOnly.map((f) => f.profile)).to.not.include(
      Trace.Profile.SIP_CONNECT
    )
    expect(sipOnly.map((f) => f.rule)).to.include("sip/max-forwards")
    const both = Trace.Rules.evaluate(record, [], { profiles: ALL })
    expect(both.map((f) => f.rule)).to.include("sip-connect/pai-single")
    // Errors come first
    expect(both[0].severity).to.equal(Trace.Severity.ERROR)
  })

  it("evaluates a whole call giving each record the ones before it", () => {
    const all = Trace.Rules.evaluateAll(FIXTURE)
    expect(all.get(3)?.map((f) => f.rule)).to.include("sip/retransmission")
    expect(all.get(2)?.map((f) => f.rule)).to.not.include("sip/retransmission")
  })

  it("never reads a hop's metadata", () => {
    const annotated = mutate(forwardedInvite, (_, __, r) => {
      r.hops[1].metadata = { route: "agentToPSTN", anything: "goes" }
    })
    expect(
      Trace.Rules.evaluate(annotated, [], { profiles: ALL })
    ).to.deep.equal(
      Trace.Rules.evaluate(forwardedInvite, [], { profiles: ALL })
    )
  })

  it("splits trace metadata from what the EdgePort may see", () => {
    const split = Trace.splitTraceMetadata({
      "trace.record": "trunk-01",
      "trace.direction": "agentToPSTN",
      accountRef: "acc-1"
    })
    expect(split).to.deep.equal({
      flag: "trunk-01",
      hop: { direction: "agentToPSTN" },
      rest: { accountRef: "acc-1" }
    })
    expect(Trace.withoutTraceMetadata(undefined)).to.equal(undefined)
    expect(
      Trace.traceAnnotations({ a: 1, b: undefined, c: "x" })
    ).to.deep.equal({ "trace.a": "1", "trace.c": "x" })
  })
})

describe("@routr/common/trace corpus helpers", () => {
  it("normalizes what differs between runs and nothing else", () => {
    const out = forwardedInvite.response.message
    const a = Trace.normalizeMessage(out)
    const b = Trace.normalizeMessage({
      ...out,
      via: out.via.map((v) => ({ ...v, branch: "z9hG4bK-other" })),
      from: { ...out.from, tag: "zzz" }
    })
    expect(Trace.isEmptyDiff(Trace.diffMessages(a, b))).to.equal(true)
    const c = Trace.normalizeMessage({
      ...out,
      maxForwards: { maxForwards: 5 }
    })
    expect(Trace.isEmptyDiff(Trace.diffMessages(a, c))).to.equal(false)
  })

  it("reports drift in outcome, status or outgoing headers", () => {
    const live = {
      ...forwardedInvite.request,
      message: forwardedInvite.response.message
    }
    expect(Trace.compareLive(forwardedInvite, live)).to.equal(undefined)
    const rejected = {
      ...live,
      message: bySeq(1).response.message
    }
    expect(Trace.compareLive(forwardedInvite, rejected)?.reason).to.include(
      "recorded forwarded, live rejected 401"
    )
    const changed = {
      ...live,
      message: { ...live.message, maxForwards: { maxForwards: 5 } }
    }
    expect(Trace.compareLive(forwardedInvite, changed)?.reason).to.equal(
      "outgoing message differs: Max-Forwards"
    )
  })

  it("validates the manifest and the file naming convention", () => {
    const m = Trace.parseManifest({
      resources: "resources",
      files: [
        { file: "seet_sc-1.3.1-dod_seet_20261023.jsonl" },
        {
          file: "zoiper_dod-invite_twilio_20261101.jsonl",
          profiles: ["sip-connect"],
          replay: false
        }
      ]
    })
    expect(m.files[0]).to.deep.equal({
      file: "seet_sc-1.3.1-dod_seet_20261023.jsonl",
      profiles: [Trace.Profile.SIP],
      replay: true,
      findings: []
    })
    expect(m.files[1].profiles).to.deep.equal([
      Trace.Profile.SIP,
      Trace.Profile.SIP_CONNECT
    ])
    expect(m.files[1].replay).to.equal(false)
    expect(() =>
      Trace.parseManifest({ resources: "r", files: [{ file: "Call 1.jsonl" }] })
    ).to.throw("does not follow")
    expect(() =>
      Trace.parseManifest({
        resources: "r",
        files: [{ file: "a_b_c_20261023.jsonl", profiles: ["nope"] }]
      })
    ).to.throw("unknown profile")
  })

  it("recomputes digests with test credentials and rewrites literals", () => {
    const record = mutate(forwardedInvite, (inMsg) => {
      inMsg.authorization = {
        username: "1001",
        realm: "sip.local",
        nonce: "n1",
        uri: "sip:sip.local",
        response: "REDACTED",
        cNonce: "",
        nonceCount: 0,
        qop: "",
        opaque: "",
        algorithm: "MD5",
        scheme: "Digest"
      } as never
    })
    const out = Trace.sanitizeRecord(record, {
      credentials: [{ username: "1001", password: "1234" }],
      rewrites: [["17853178070", "15555550100"]]
    })
    expect(out.request.message.authorization.response).to.match(
      /^[0-9a-f]{32}$/
    )
    expect(out.request.message.authorization.response).to.not.equal("REDACTED")
    expect(JSON.stringify(out)).to.not.include("17853178070")
    expect(JSON.stringify(out)).to.include("15555550100")
    expect(() => Trace.sanitizeRecord(record, { credentials: [] })).to.throw(
      `no credential for digest username ${q("1001")}`
    )
    expect(
      Trace.credentialsFromResources([
        { spec: { credentials: { username: "a", password: "b" } } },
        { spec: {} }
      ])
    ).to.deep.equal([{ username: "a", password: "b" }])
  })
})

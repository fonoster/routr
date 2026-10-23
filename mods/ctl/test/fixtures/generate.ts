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
// Generates the example traces used by the rctl trace tests and docs by
// driving the real dispatcher Recorder with synthetic component replies.
//
//   npx ts-node mods/ctl/test/fixtures/generate.ts
import { writeFileSync } from "fs"
import { join } from "path"
import { CommonTypes as CT, MessageRequest, Trace } from "@routr/common"
import {
  HopCollector,
  Recorder,
  RecordingMode
} from "../../../dispatcher/src/recorder"

const AGENT: CT.NetInterface = {
  host: "10.111.221.22",
  port: 5506,
  transport: CT.Transport.UDP
}
const TRUNK: CT.NetInterface = {
  host: "10.111.220.22",
  port: 7060,
  transport: CT.Transport.UDP
}
const LP: CT.NetInterface = {
  host: "10.111.221.2",
  port: 5060,
  transport: CT.Transport.UDP
}
const CALL_ID = "1-25@10.111.221.22"
const OWN_VIA = {
  host: "10.111.220.2",
  port: 5060,
  transport: CT.Transport.UDP,
  branch: "z9hG4bK-353730-e6d92929c39126added013258bf053e6",
  rPortFlag: true
}
const SDP =
  "v=0\r\no=user1 53655765 2353687637 IN IP4 10.111.221.22\r\ns=-\r\nc=IN IP4 10.111.221.22\r\nt=0 0\r\nm=audio 6000 RTP/AVP 0\r\na=rtpmap:0 PCMU/8000\r\n"

type Msg = CT.SIPMessage
// Lint wants double-quoted strings and prettier wants the fewest escapes;
// values with embedded quotes are built with this helper to satisfy both
const quoted = (text: string) => `"${text}"`

// The fixture's total time is the sum of its hops, not the wall clock of
// this script
// eslint-disable-next-line require-jsdoc
class FixtureCollector extends HopCollector {
  // eslint-disable-next-line require-jsdoc
  elapsedMs(): number {
    return (
      Math.round((this.hops.reduce((n, h) => n + h.durationMs, 0) + 0.6) * 10) /
      10
    )
  }
}
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x))

const base = (): Omit<Msg, "messageType"> => ({
  from: {
    address: {
      displayName: "John Doe",
      uri: { user: "1001", host: "sip.local" }
    },
    tag: "1"
  },
  to: { address: { uri: { user: "17853178070", host: "sip.local" } } },
  callId: { callId: CALL_ID },
  contentLength: { contentLength: 0 },
  maxForwards: { maxForwards: 70 },
  via: [
    {
      host: AGENT.host,
      port: AGENT.port,
      transport: CT.Transport.UDP,
      branch: "z9hG4bK-25-1-4",
      rPortFlag: true,
      received: AGENT.host,
      rPort: AGENT.port
    }
  ],
  route: [],
  recordRoute: [],
  extensions: []
})

const request = (
  method: string,
  cseq: number,
  extra: Partial<Msg> = {}
): Msg => ({
  messageType: CT.MessageType.REQUEST,
  ...base(),
  requestUri: {
    user: "17853178070",
    host: "sip.local",
    transportParam: CT.Transport.UDP
  },
  contact: {
    address: {
      uri: {
        user: "sipp",
        host: AGENT.host,
        port: AGENT.port,
        transportParam: CT.Transport.UDP
      }
    },
    expires: 0,
    qValue: 0
  },
  extensions: [
    { name: "CSeq", value: `${cseq} ${method}` },
    { name: "User-Agent", value: "SIPp" }
  ],
  ...extra
})

const response = (
  type: CT.ResponseType,
  cseq: string,
  vias: CT.Via[],
  extra: Partial<Msg> = {}
): Msg => ({
  messageType: CT.MessageType.RESPONSE,
  responseType: type,
  ...base(),
  via: vias,
  extensions: [{ name: "CSeq", value: cseq }],
  ...extra
})

const envelope = (
  sender: CT.NetInterface,
  method: string,
  message: Msg,
  version: string
): MessageRequest => ({
  ref: CALL_ID,
  edgePortRef: "edgeport-01",
  edgePortVersion: version,
  method: method as CT.Method,
  sender,
  listeningPoints: [
    LP,
    { ...LP, transport: CT.Transport.TCP },
    { ...LP, port: 5061, transport: CT.Transport.TLS }
  ],
  externalAddrs: ["10.111.220.2", "sip01.edgeport.net"],
  localnets: ["127.0.0.1/8", "10.111.221.2/24"],
  message
})

interface Scenario {
  version: string
  file: string
  doublePai: boolean
  reInviteFails: boolean
}

// eslint-disable-next-line require-jsdoc
async function run(s: Scenario): Promise<string> {
  const lines: string[] = []
  let now = Date.parse("2026-10-23T02:41:10.321Z")
  const recorder = new Recorder(
    "message-dispatcher",
    { enabled: true, path: "/tmp", mode: RecordingMode.ALL },
    {
      appendFile: async (_, data) => {
        lines.push(data)
      },
      now: () => now
    }
  )
  const at = (offset: number) => {
    now = Date.parse("2026-10-23T02:41:10.321Z") + offset
  }

  const rec = (
    sender: CT.NetInterface,
    method: string,
    msg: Msg,
    build: (c: HopCollector, m: Msg) => Msg | undefined,
    flag?: string
  ) => {
    const req = envelope(sender, method, msg, s.version)
    const collector = new FixtureCollector()
    const out = build(collector, msg)
    recorder.record({
      request: req,
      result: out
        ? {
            ...req,
            message: out,
            metadata: flag
              ? { "routr.trace": flag, accountRef: "domain-01" }
              : undefined
          }
        : undefined,
      collector,
      flag
    })
  }
  const matched = (c: HopCollector) =>
    c.add({
      component: "dispatcher",
      kind: Trace.HopKind.DISPATCHER,
      durationMs: 0.4,
      action: Trace.HopAction.MATCHED
    })
  const call = (
    c: HopCollector,
    component: string,
    kind: Trace.HopKind,
    before: Msg,
    after: Msg | undefined,
    ms: number,
    error?: string
  ) => {
    const startedAt = (c as unknown as { startedAt: number }).startedAt
    if (error) {
      c.addError({ component, kind, startedAt, error })
      return
    }
    c.addCall({
      component,
      kind,
      version: s.version,
      startedAt: startedAt - ms,
      before,
      after
    })
  }

  // 1. INVITE c1, challenged
  at(0)
  const inv1 = request("INVITE", 1, {
    body: SDP,
    extensions: [
      { name: "CSeq", value: "1 INVITE" },
      { name: "User-Agent", value: "SIPp" },
      { name: "Privacy", value: "id" },
      { name: "Content-Type", value: "application/sdp" }
    ]
  })
  rec(AGENT, "INVITE", inv1, (c, m) => {
    matched(c)
    const r = response(CT.ResponseType.UNAUTHORIZED, "1 INVITE", m.via, {
      wwwAuthenticate: {
        realm: "sip.local",
        domain: "",
        nonce: "b4a7c1",
        scheme: "Digest",
        algorithm: "MD5",
        qop: "auth",
        opaque: "",
        stale: false
      }
    })
    call(c, "connect-processor", Trace.HopKind.PROCESSOR, m, r, 5.2)
    return r
  })

  // 2. INVITE c2 with credentials, forwarded
  at(81)
  const inv2 = request("INVITE", 2, {
    body: SDP,
    authorization: {
      realm: "sip.local",
      scheme: "Digest",
      nonce: "b4a7c1",
      cNonce: "9f1",
      nonceCount: 1,
      response: "3f2a9c1e7b",
      username: "1001",
      uri: "sip:10.111.221.2:5060",
      algorithm: "MD5",
      qop: "auth",
      opaque: ""
    },
    extensions: [
      { name: "CSeq", value: "2 INVITE" },
      { name: "User-Agent", value: "SIPp" },
      { name: "Privacy", value: "id" },
      { name: "Content-Type", value: "application/sdp" },
      ...(s.doublePai
        ? [
            {
              name: "P-Asserted-Identity",
              value: `${quoted("John Doe")} <sip:1001@sip.local>`
            }
          ]
        : [])
    ]
  })
  const forwardInvite = (m: Msg): Msg => {
    const out = clone(m)
    out.requestUri = {
      user: "17853178070",
      host: "sip.provider.net",
      port: 7060,
      transportParam: CT.Transport.UDP
    }
    out.maxForwards = { maxForwards: 69 }
    out.via = [OWN_VIA, ...m.via]
    out.recordRoute = [
      {
        address: {
          uri: {
            host: "10.111.221.2",
            port: 5060,
            lrParam: true,
            transportParam: CT.Transport.UDP
          }
        }
      }
    ]
    delete out.authorization
    out.extensions = out.extensions.filter(
      (e) =>
        e.name !== "Privacy" &&
        (s.doublePai || e.name !== "P-Asserted-Identity")
    )
    out.extensions.push(
      { name: "Privacy", value: "none" },
      {
        name: "Remote-Party-ID",
        value: "<sip:+17066041487@sip.provider.net>;screen=yes;party=calling"
      },
      {
        name: "P-Asserted-Identity",
        value: `${quoted(
          "John Doe"
        )} <sip:+17066041487@sip.provider.net;user=phone>`
      },
      { name: "X-Gateway-Auth", value: "dHJ1bmstMDE6c2VjcmV0" },
      { name: "X-Call-Direction", value: "agent-to-pstn" }
    )
    return out
  }
  rec(
    AGENT,
    "INVITE",
    inv2,
    (c, m) => {
      matched(c)
      call(c, "rtprelay", Trace.HopKind.MIDDLEWARE, m, m, 3.1)
      const out = forwardInvite(m)
      call(c, "connect-processor", Trace.HopKind.PROCESSOR, m, out, 11.8)
      return out
    },
    "trunk-01"
  )

  // 3. INVITE c2 retransmitted by the agent (T1 fired), forwarded again
  at(581)
  rec(AGENT, "INVITE", inv2, (c, m) => {
    matched(c)
    call(c, "rtprelay", Trace.HopKind.MIDDLEWARE, m, m, 2.4)
    const out = forwardInvite(m)
    call(c, "connect-processor", Trace.HopKind.PROCESSOR, m, out, 9.9)
    return out
  })

  const fromTrunk = (
    type: CT.ResponseType,
    cseq: string,
    extra: Partial<Msg> = {}
  ) =>
    response(type, cseq, [OWN_VIA, ...base().via], {
      to: {
        address: { uri: { user: "17853178070", host: "sip.local" } },
        tag: "trk-77"
      },
      contact: {
        address: {
          uri: { user: "17853178070", host: TRUNK.host, port: TRUNK.port }
        },
        expires: 0,
        qValue: 0
      },
      recordRoute: [
        {
          address: {
            uri: {
              host: "10.111.221.2",
              port: 5060,
              lrParam: true,
              transportParam: CT.Transport.UDP
            }
          }
        }
      ],
      ...extra
    })
  const relay = (c: HopCollector, m: Msg, ms: number) => {
    matched(c)
    const out = clone(m)
    out.via = m.via.slice(1)
    call(c, "connect-processor", Trace.HopKind.PROCESSOR, m, out, ms)
    return out
  }

  // 4. 180 Ringing from the trunk
  at(962)
  rec(TRUNK, "INVITE", fromTrunk(CT.ResponseType.RINGING, "2 INVITE"), (c, m) =>
    relay(c, m, 0.9)
  )
  // 5. 200 OK with SDP
  at(1171)
  rec(
    TRUNK,
    "INVITE",
    fromTrunk(CT.ResponseType.OK, "2 INVITE", {
      body: SDP.replace("10.111.221.22", "10.111.220.22").replace(
        "6000",
        "7000"
      )
    }),
    (c, m) => relay(c, m, 1.2)
  )

  // 6. ACK c2 from the agent, in-dialog
  at(1176)
  const inDialog = (method: string, cseq: number, extra: Partial<Msg> = {}) =>
    request(method, cseq, {
      to: {
        address: { uri: { user: "17853178070", host: "sip.local" } },
        tag: "trk-77"
      },
      route: [
        {
          address: {
            uri: {
              host: "10.111.221.2",
              port: 5060,
              lrParam: true,
              transportParam: CT.Transport.UDP
            }
          }
        }
      ],
      requestUri: { user: "17853178070", host: TRUNK.host, port: TRUNK.port },
      ...extra
    })
  const forwardInDialog = (c: HopCollector, m: Msg, ms: number) => {
    matched(c)
    const out = clone(m)
    out.route = []
    out.maxForwards = { maxForwards: (m.maxForwards?.maxForwards ?? 70) - 1 }
    out.via = [OWN_VIA, ...m.via]
    call(c, "connect-processor", Trace.HopKind.PROCESSOR, m, out, ms)
    return out
  }
  rec(AGENT, "ACK", inDialog("ACK", 2), (c, m) => forwardInDialog(c, m, 1.8))

  // 7. re-INVITE c1 from the trunk (hold / codec change)
  at(1681)
  const reInvite = request("INVITE", 1, {
    requestUri: { user: "sipp", host: AGENT.host, port: AGENT.port },
    from: {
      address: { uri: { user: "17853178070", host: "sip.provider.net" } },
      tag: "trk-77"
    },
    to: {
      address: {
        displayName: "John Doe",
        uri: { user: "1001", host: "sip.local" }
      },
      tag: "1"
    },
    via: [
      {
        host: TRUNK.host,
        port: TRUNK.port,
        transport: CT.Transport.UDP,
        branch: "z9hG4bK-trk-9a1",
        rPortFlag: true
      }
    ],
    route: [
      {
        address: {
          uri: {
            host: "10.111.221.2",
            port: 5060,
            lrParam: true,
            transportParam: CT.Transport.UDP
          }
        }
      }
    ],
    body: SDP.replace("10.111.221.22", "10.111.220.22")
      .replace("6000", "7000")
      .replace("PCMU", "PCMA"),
    extensions: [
      { name: "CSeq", value: "1 INVITE" },
      { name: "Content-Type", value: "application/sdp" }
    ]
  })
  if (s.reInviteFails) {
    rec(TRUNK, "INVITE", reInvite, (c, m) => {
      matched(c)
      call(
        c,
        "connect-processor",
        Trace.HopKind.PROCESSOR,
        m,
        undefined,
        7.0,
        "UnsupportedRoutingError: unsupported routing direction: unknown"
      )
      c.hops[c.hops.length - 1].action = Trace.HopAction.RESPONDED
      delete c.hops[c.hops.length - 1].error
      c.hops[c.hops.length - 1].error =
        "UnsupportedRoutingError: unsupported routing direction: unknown"
      return response(
        CT.ResponseType.SERVER_INTERNAL_ERROR,
        "1 INVITE",
        m.via,
        { from: m.from, to: m.to }
      )
    })
  } else {
    rec(TRUNK, "INVITE", reInvite, (c, m) => {
      matched(c)
      const out = clone(m)
      out.route = []
      out.maxForwards = { maxForwards: 69 }
      out.via = [
        {
          ...OWN_VIA,
          host: "10.111.221.2",
          branch: "z9hG4bK-353730-0c71aa9e1f"
        },
        ...m.via
      ]
      call(c, "connect-processor", Trace.HopKind.PROCESSOR, m, out, 2.2)
      return out
    })
    // 8. 200 OK from the agent to the re-INVITE, relayed
    at(1690)
    rec(
      AGENT,
      "INVITE",
      response(
        CT.ResponseType.OK,
        "1 INVITE",
        [
          {
            ...OWN_VIA,
            host: "10.111.221.2",
            branch: "z9hG4bK-353730-0c71aa9e1f"
          },
          reInvite.via[0]
        ],
        { from: reInvite.from, to: reInvite.to, body: SDP }
      ),
      (c, m) => relay(c, m, 1.5)
    )
    // 9. ACK c1 from the trunk
    at(1694)
    rec(
      TRUNK,
      "ACK",
      {
        ...reInvite,
        requestUri: { user: "sipp", host: AGENT.host, port: AGENT.port },
        body: undefined,
        extensions: [{ name: "CSeq", value: "1 ACK" }]
      },
      (c, m) => forwardInDialog(c, m, 1.4)
    )
  }

  // 10. BYE c3 from the agent
  at(2002)
  rec(AGENT, "BYE", inDialog("BYE", 3), (c, m) => forwardInDialog(c, m, 1.7))
  // 11. 200 OK to the BYE
  at(2009)
  rec(
    TRUNK,
    "BYE",
    fromTrunk(CT.ResponseType.OK, "3 BYE", { recordRoute: [] }),
    (c, m) => relay(c, m, 1.2)
  )

  // Appends are queued per call; let them drain
  await new Promise((resolve) => setTimeout(resolve, 20))
  return lines.join("")
}

const dir = __dirname
const scenarios: Scenario[] = [
  {
    version: "2.18.0",
    file: "call-2.18.0.jsonl",
    doublePai: false,
    reInviteFails: false
  },
  {
    version: "2.15.4",
    file: "call-2.15.4.jsonl",
    doublePai: true,
    reInviteFails: true
  }
]
Promise.all(
  scenarios.map(async (s) => {
    const text = await run(s)
    // Every line must pass the reader the viewer uses
    Trace.parseTrace(text)
    writeFileSync(join(dir, s.file), text)
    // eslint-disable-next-line no-console
    console.log(`${s.file}: ${text.split("\n").filter(Boolean).length} records`)
  })
).catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exit(1)
})

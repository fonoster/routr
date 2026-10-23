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
import sinon from "sinon"
import sinonChai from "sinon-chai"
import { EventEmitter } from "events"
import { tmpdir } from "os"
import { join } from "path"
import {
  MessageRequest,
  Method,
  ProcessorConfig,
  Trace,
  CommonTypes as CT
} from "@routr/common"
import processor from "../src/processor"
import * as connectionsModule from "../src/connections"
import * as yaml from "js-yaml"
import * as fs from "fs"
import {
  fileNameFor,
  HopCollector,
  Recorder,
  RecordingMode
} from "../src/recorder"
import { getConfig } from "../src/config/get_config"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

const message = (overrides: Partial<CT.SIPMessage> = {}): CT.SIPMessage =>
  ({
    messageType: CT.MessageType.REQUEST,
    requestUri: { user: "17853178070", host: "sip.local" },
    from: { address: { uri: { user: "1001", host: "sip.local" } }, tag: "1" },
    to: { address: { uri: { user: "17853178070", host: "sip.local" } } },
    callId: { callId: "call-1" },
    contentLength: { contentLength: 0 },
    maxForwards: { maxForwards: 70 },
    extensions: [{ name: "CSeq", value: "1 INVITE" }],
    via: [{ host: "10.0.0.2", port: 5060, transport: CT.Transport.UDP }],
    route: [],
    recordRoute: [],
    ...overrides
  } as CT.SIPMessage)

const request = (overrides: Partial<MessageRequest> = {}): MessageRequest => ({
  ref: "call-1",
  edgePortRef: "edgeport-01",
  edgePortVersion: "2.18.0",
  method: Method.INVITE,
  sender: { host: "10.0.0.2", port: 5060, transport: CT.Transport.UDP },
  listeningPoints: [],
  externalAddrs: [],
  localnets: [],
  message: message(),
  ...overrides
})

const newRecorder = (
  config: Partial<ConstructorParameters<typeof Recorder>[1]> = {}
) => {
  const writes: { file: string; line: string }[] = []
  let clock = 1_700_000_000_000
  const recorder = new Recorder(
    "dispatcher-test",
    { enabled: true, path: join(tmpdir(), "routr-traces-test"), ...config },
    {
      appendFile: async (file, data) => {
        writes.push({ file, line: data })
      },
      now: () => clock
    }
  )
  return {
    recorder,
    writes,
    advance: (ms: number) => (clock += ms),
    flush: () => new Promise((r) => setImmediate(r)),
    records: () => writes.map((w) => Trace.validateRecord(JSON.parse(w.line)))
  }
}

describe("@routr/dispatcher recorder", () => {
  afterEach(() => sandbox.restore())

  it("builds file names that sort by time and are file system safe", () => {
    expect(fileNameFor(1_700_000_000_000, "1-25@10.111.221.22")).to.equal(
      "20231114T221320000Z-1-25_10.111.221.22.jsonl"
    )
  })

  it("records nothing in flagged mode until a processor flags the call", async () => {
    const r = newRecorder({ mode: RecordingMode.FLAGGED })
    r.recorder.record({ request: request(), collector: new HopCollector() })
    await r.flush()
    expect(r.writes).to.have.length(0)
    expect(r.recorder.activeCalls()).to.equal(0)
  })

  it("records a flagged call and every later message of it", async () => {
    const r = newRecorder({ mode: RecordingMode.FLAGGED })
    const collector = new HopCollector()
    collector.add({
      component: "dispatcher",
      kind: Trace.HopKind.DISPATCHER,
      durationMs: 0.2,
      action: Trace.HopAction.MATCHED
    })

    r.recorder.record({
      request: request(),
      result: request({
        metadata: { "trace.record": "trunk-01", accountRef: "a" }
      }),
      collector,
      flag: "trunk-01"
    })
    r.advance(80)
    r.recorder.record({
      request: request({
        method: Method.BYE,
        message: message({ extensions: [{ name: "CSeq", value: "2 BYE" }] })
      }),
      result: request({ method: Method.BYE }),
      collector: new HopCollector()
    })
    await r.flush()

    const records = r.records()
    expect(records).to.have.length(2)
    expect(records[0]).to.include({
      seq: 1,
      tOffsetMs: 0,
      kind: Trace.TraceKind.REQUEST,
      method: "INVITE",
      trunkRef: "trunk-01",
      outcome: Trace.TraceOutcome.FORWARDED
    })
    expect(records[0].edgePort).to.deep.equal({
      ref: "edgeport-01",
      version: "2.18.0"
    })
    expect(records[0].dispatcher.ref).to.equal("dispatcher-test")
    expect(records[0].dispatcher.version).to.match(/^\d+\.\d+\.\d+/)
    expect(records[0].response.metadata).to.deep.equal({ accountRef: "a" })
    expect(records[0].hops[0].action).to.equal("matched")
    expect(records[1]).to.include({ seq: 2, tOffsetMs: 80, method: "BYE" })
    expect(r.writes[0].file).to.equal(r.writes[1].file)
  })

  it("records every call in all mode and classifies outcomes", async () => {
    const r = newRecorder({ mode: RecordingMode.ALL })
    const rejected = request({
      message: message({
        messageType: CT.MessageType.RESPONSE,
        responseType: CT.ResponseType.FORBIDDEN
      })
    })
    r.recorder.record({
      request: request(),
      result: rejected,
      collector: new HopCollector()
    })
    const ringing = request({
      message: message({
        messageType: CT.MessageType.RESPONSE,
        responseType: CT.ResponseType.RINGING
      })
    })
    r.recorder.record({
      request: ringing,
      result: ringing,
      collector: new HopCollector()
    })
    r.recorder.record({
      request: request({ ref: "call-2" }),
      collector: new HopCollector(),
      error: new Error("processor unavailable")
    })
    const registerOk = request({
      ref: "call-3",
      method: Method.REGISTER,
      message: message({
        messageType: CT.MessageType.RESPONSE,
        responseType: CT.ResponseType.OK
      })
    })
    r.recorder.record({
      request: request({ ref: "call-3", method: Method.REGISTER }),
      result: registerOk,
      collector: new HopCollector()
    })
    await r.flush()

    // Writes are serialized per call, not across calls
    const records = r
      .records()
      .sort((a, b) => a.callId.localeCompare(b.callId) || a.seq - b.seq)
    expect(records.map((x) => [x.kind, x.outcome, x.status])).to.deep.equal([
      ["request", "rejected", 403],
      ["response", "relayed", 180],
      ["request", "error", undefined],
      ["request", "answered", 200]
    ])
    expect(records[2].response).to.equal(null)
    expect(r.recorder.activeCalls()).to.equal(3)
  })

  it("redacts credentials before writing", async () => {
    const r = newRecorder({ mode: RecordingMode.ALL })
    const req = request({
      message: message({
        authorization: {
          realm: "sip.local",
          scheme: "Digest",
          nonce: "n",
          cNonce: "c",
          nonceCount: 1,
          response: "secret",
          username: "1001",
          uri: "sip:sip.local",
          algorithm: "MD5",
          qop: "auth",
          opaque: ""
        }
      })
    })
    r.recorder.record({
      request: req,
      result: req,
      collector: new HopCollector()
    })
    await r.flush()
    expect(r.writes[0].line).to.not.include("secret")
    expect(r.records()[0].request.message.authorization.response).to.equal(
      Trace.REDACTED
    )
  })

  it("caps records per call and forgets idle calls", async () => {
    const r = newRecorder({
      mode: RecordingMode.ALL,
      maxRecordsPerCall: 2,
      idleTimeoutSeconds: 10
    })
    const req = request()
    r.recorder.record({
      request: req,
      result: req,
      collector: new HopCollector()
    })
    r.recorder.record({
      request: req,
      result: req,
      collector: new HopCollector()
    })
    r.recorder.record({
      request: req,
      result: req,
      collector: new HopCollector()
    })
    await r.flush()
    expect(r.writes).to.have.length(2)

    r.advance(11_000)
    ;(r.recorder as unknown as { sweep: () => void }).sweep()
    expect(r.recorder.activeCalls()).to.equal(0)
  })

  it("never lets a write failure reach the caller", async () => {
    const recorder = new Recorder(
      "d",
      {
        enabled: true,
        path: join(tmpdir(), "routr-traces-test"),
        mode: RecordingMode.ALL
      },
      { appendFile: async () => Promise.reject(new Error("disk full")) }
    )
    expect(() =>
      recorder.record({ request: request(), collector: new HopCollector() })
    ).to.not.throw()
    await new Promise((r) => setImmediate(r))
  })
})

describe("@routr/dispatcher pipeline with recording", () => {
  afterEach(() => sandbox.restore())

  // A fake gRPC client that answers with `reply` and announces a version
  const fakeConnection = (
    reply: (req: MessageRequest) => MessageRequest,
    version = "9.9.9"
  ) => ({
    processMessage: (req: MessageRequest, cb: CT.GrpcCallback) => {
      const call = new EventEmitter()
      setImmediate(() => {
        const md = {
          get: (k: string) => (k === "routr-component-version" ? [version] : [])
        }
        call.emit("metadata", md)
        cb(null, reply(req))
      })
      return call
    }
  })

  const processors: ProcessorConfig[] = [
    {
      ref: "connect-processor",
      addr: "localhost:1",
      methods: [Method.INVITE, Method.BYE],
      matchFunc: () => true
    }
  ]

  it("collects hops with timing, versions and diffs, and strips the flag", async () => {
    const r = newRecorder({ mode: RecordingMode.FLAGGED })
    const handler = processor({
      processors,
      middlewares: [],
      recorder: r.recorder
    })

    const connections = new Map()
    connections.set(
      "connect-processor",
      fakeConnection((req) => ({
        ...req,
        metadata: { "trace.record": "trunk-01" },
        message: {
          ...req.message,
          requestUri: { user: "17853178070", host: "sip.provider.net" },
          maxForwards: { maxForwards: 69 }
        }
      }))
    )
    // Swap the real gRPC clients for the fakes
    sandbox.stub(connectionsModule, "default").returns(connections)
    const handler2 = processor({
      processors,
      middlewares: [],
      recorder: r.recorder
    })

    const result = await new Promise<MessageRequest>((resolve, reject) =>
      handler2(
        { request: request() } as never,
        (err: Error, res: MessageRequest) => (err ? reject(err) : resolve(res))
      )
    )
    await r.flush()

    expect(result.metadata).to.deep.equal({})
    expect(handler).to.be.a("function")

    const [record] = r.records()
    expect(record.trunkRef).to.equal("trunk-01")
    expect(record.hops.map((h) => h.component)).to.deep.equal([
      "dispatcher",
      "connect-processor"
    ])
    const hop = record.hops[1]
    expect(hop.version).to.equal("9.9.9")
    expect(hop.action).to.equal(Trace.HopAction.FORWARDED)
    expect(hop.durationMs).to.be.a("number")
    expect(hop.diff.requestUri).to.deep.equal({
      from: "sip:17853178070@sip.local",
      to: "sip:17853178070@sip.provider.net"
    })
    expect(hop.diff.headers.changed["Max-Forwards"]).to.deep.equal({
      from: "70",
      to: "69"
    })
    expect(record.totalMs).to.be.at.least(hop.durationMs)
  })

  it("lifts trace.* metadata into the hop and strips it before the EdgePort", async () => {
    const r = newRecorder({ mode: RecordingMode.ALL })
    const connections = new Map()
    connections.set(
      "connect-processor",
      fakeConnection((req) => ({
        ...req,
        metadata: {
          "trace.record": "agent-1001",
          "trace.direction": "agentToPSTN",
          "trace.trunk": "trunk-01",
          accountRef: "acc-1"
        }
      }))
    )
    sandbox.stub(connectionsModule, "default").returns(connections)
    const handler = processor({
      processors,
      middlewares: [],
      recorder: r.recorder
    })

    const result = await new Promise<MessageRequest>((resolve, reject) =>
      handler(
        { request: request() } as never,
        (err: Error, res: MessageRequest) => (err ? reject(err) : resolve(res))
      )
    )
    await r.flush()

    expect(result.metadata).to.deep.equal({ accountRef: "acc-1" })
    const [record] = r.records()
    expect(record.trunkRef).to.equal("agent-1001")
    expect(record.hops[1].metadata).to.deep.equal({
      direction: "agentToPSTN",
      trunk: "trunk-01"
    })
    expect(record.response.metadata).to.deep.equal({ accountRef: "acc-1" })
    expect(record.request.metadata).to.equal(undefined)
    expect(record.request.receivedOn).to.equal(undefined)
  })

  it("keeps credentials and evaluates rules when configured to", async () => {
    const r = newRecorder({
      mode: RecordingMode.ALL,
      redact: false,
      lint: { profiles: [Trace.Profile.SIP], window: 4 }
    })
    const connections = new Map()
    connections.set(
      "connect-processor",
      fakeConnection((req) => ({
        ...req,
        // Forwarded without decrementing Max-Forwards: a sip/max-forwards finding
        message: {
          ...req.message,
          via: [
            { host: "10.0.0.1", port: 5060, transport: CT.Transport.UDP },
            ...req.message.via
          ]
        }
      }))
    )
    sandbox.stub(connectionsModule, "default").returns(connections)
    const handler = processor({
      processors,
      middlewares: [],
      recorder: r.recorder
    })
    const withAuth = request({
      listeningPoints: [
        { host: "10.0.0.1", port: 5060, transport: CT.Transport.UDP }
      ],
      message: message({
        authorization: {
          username: "1001",
          realm: "sip.local",
          nonce: "n1",
          response: "d1g3st"
        } as never
      })
    })

    await new Promise<MessageRequest>((resolve, reject) =>
      handler(
        { request: withAuth } as never,
        (err: Error, res: MessageRequest) => (err ? reject(err) : resolve(res))
      )
    )
    await r.flush()

    const [record] = r.records()
    expect(record.request.message.authorization.response).to.equal("d1g3st")
    expect(record.lint.profiles).to.deep.equal([Trace.Profile.SIP])
    expect(record.lint.version).to.be.a("string")
    expect(record.findings.map((f) => f.rule)).to.include("sip/max-forwards")
    expect(record.findings.map((f) => f.rule)).to.include(
      "sip/credentials-stripped"
    )
    expect(r.recorder.activeCalls()).to.equal(1)
  })

  it("records an error hop when the processor is unavailable", async () => {
    const r = newRecorder({ mode: RecordingMode.ALL })
    const connections = new Map()
    connections.set("connect-processor", {
      processMessage: (_: unknown, cb: CT.GrpcCallback) =>
        setImmediate(() => cb({ code: 14 }))
    })
    sandbox.stub(connectionsModule, "default").returns(connections)
    const handler = processor({
      processors,
      middlewares: [],
      recorder: r.recorder
    })

    const err = await new Promise<Error>((resolve) =>
      handler({ request: request() } as never, (e: Error) => resolve(e))
    )
    await r.flush()

    expect(err.message).to.include("connect-processor")
    const [record] = r.records()
    expect(record.outcome).to.equal(Trace.TraceOutcome.ERROR)
    expect(record.hops[1].action).to.equal(Trace.HopAction.ERROR)
    expect(record.hops[1].error).to.include("connect-processor")
  })
})

describe("@routr/dispatcher recording config", () => {
  it("accepts a recording block and rejects a bad mode", () => {
    const good = getConfig(__dirname + "/../../../config/dispatcher.yaml")
    expect(good._tag).to.equal("Right")
    const bad = yaml.load(
      fs.readFileSync(__dirname + "/../../../config/dispatcher.yaml", "utf8")
    ) as { spec: Record<string, unknown> }
    bad.spec = {
      ...bad.spec,
      recording: { enabled: true, path: "/tmp", mode: "sometimes" }
    }
    const file = join(tmpdir(), "dispatcher-bad.yaml")
    fs.writeFileSync(file, yaml.dump(bad))
    expect(getConfig(file)._tag).to.equal("Left")
  })
})

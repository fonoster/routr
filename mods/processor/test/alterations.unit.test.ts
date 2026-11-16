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
import {
  createPSTNMessage,
  request,
  route,
  routeOnAnotherEdgePort
} from "./examples"
import {
  CommonTypes as CT,
  Helper as H,
  IpUtils,
  MessageRequest,
  Transport
} from "@routr/common"
import { Alterations as A, Extensions as E, Helper } from "../src"
import { pipe } from "fp-ts/function"
import { getEdgeInterface } from "../src/helper"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/processor/alterations", () => {
  afterEach(() => sandbox.restore())

  it("updates the request uri", () => {
    const r = A.fixRequestURI(route)(request)
    expect(r)
      .to.have.property("message")
      .to.have.property("requestUri")
      .to.have.property("host")
      .to.be.equal(route.host)
    expect(r)
      .to.have.property("message")
      .to.have.property("requestUri")
      .to.have.property("port")
      .to.be.equal(route.port)
    expect(r)
      .to.have.property("message")
      .to.have.property("requestUri")
      .to.have.property("transportParam")
      .to.be.equal(route.transport)
  })

  // The original dialed identifier (e.g. a PSTN DID) as it arrives in the
  // Request-URI before fixRequestURI runs.
  const dialedNumber = "17853178070"
  const requestWithDialedNumber = {
    ...request,
    message: {
      ...request.message,
      requestUri: { ...request.message.requestUri, user: dialedNumber }
    }
  }

  it("rewrites the request uri user with the route user for a registered route", () => {
    const r = A.fixRequestURI(route)(requestWithDialedNumber)
    expect(r)
      .to.have.property("message")
      .to.have.property("requestUri")
      .to.have.property("user")
      .to.be.equal(route.user)
  })

  it("keeps the original request uri user when route.user is falsy (outbound trunk)", () => {
    const r = A.fixRequestURI({ ...route, user: "" })(requestWithDialedNumber)
    expect(r)
      .to.have.property("message")
      .to.have.property("requestUri")
      .to.have.property("user")
      .to.be.equal(dialedNumber)
  })

  it("keeps the original request uri user when the route is not registered", () => {
    const r = A.fixRequestURI({ ...route, registeredOn: undefined })(
      requestWithDialedNumber
    )
    expect(r)
      .to.have.property("message")
      .to.have.property("requestUri")
      .to.have.property("user")
      .to.be.equal(dialedNumber)
  })

  it("updates the value of the max forwards header", () => {
    const r = A.decreaseMaxForwards(request)
    expect(r)
      .to.have.property("message")
      .to.have.property("maxForwards")
      .to.have.property("maxForwards")
      .to.be.equal(69)
  })

  it("adds via header and same edgeport", () => {
    const r = A.addSelfVia(route)(request)
    const targetIntf = getEdgeInterface({
      listeningPoints: request.listeningPoints,
      localnets: request.localnets,
      externalAddrs: request.externalAddrs,
      endpointIntf: route
    })
    expect(r).to.have.property("message").to.have.property("via").lengthOf(3)
    expect(r.message.via[0].host).to.be.equal(targetIntf.host)
    expect(r.message.via[0].port).to.be.equal(targetIntf.port)
    expect(r.message.via[0].transport).to.be.equal(targetIntf.transport)
  })

  it("adds via header and different edgeport", () => {
    const r = A.addSelfVia(routeOnAnotherEdgePort)(request)
    expect(r).to.have.property("message").to.have.property("via").lengthOf(3)
    const targetIntf = getEdgeInterface({
      listeningPoints: routeOnAnotherEdgePort.listeningPoints,
      localnets: routeOnAnotherEdgePort.localnets,
      externalAddrs: routeOnAnotherEdgePort.externalAddrs,
      endpointIntf: routeOnAnotherEdgePort
    })
    expect(r.message.via[0].host).to.be.equal(targetIntf.host)
    expect(r.message.via[0].port).to.be.equal(targetIntf.port)
    expect(r.message.via[0].transport).to.be.equal(targetIntf.transport)
  })

  it("removes the top via header", () => {
    expect(
      (A.removeTopVia(request).message.via as unknown as [{ host: string }])[0]
    )
      .to.have.property("host")
      .to.be.equal("127.0.0.1")
  })

  it("adds record-route using the listening point from the request", () => {
    const r = A.addSelfRecordRoute(route)(request)
    expect(r.message.recordRoute).to.be.lengthOf(2)
    const uri = r.message.recordRoute[0].address.uri
    expect(uri).to.have.property("host").to.be.equal("127.0.0.1")
    expect(uri).to.have.property("port").to.be.equal(5060)
    expect(uri).to.have.property("transportParam").to.be.equal(Transport.TCP)
  })

  it("adds route header from the route object", () => {
    const r = A.addRouteToNextHop(route)(request)
    expect(r.message.route).to.be.lengthOf(3)
    const uri = r.message.route[0].address.uri
    expect(uri).to.have.property("host").to.be.equal(route.host)
    expect(uri).to.have.property("port").to.be.equal(route.port)
    expect(uri).to.have.property("transportParam").to.be.equal(route.transport)
  })

  it("adds route header using the listening point from the route object", () => {
    const r = A.addRouteToPeerEdgePort(route)(request)
    expect(r.message.route).to.be.lengthOf(3)
    const uri = r.message.route[0].address.uri
    const targetIntf = getEdgeInterface({
      listeningPoints: request.listeningPoints,
      localnets: request.localnets,
      externalAddrs: request.externalAddrs,
      endpointIntf: route
    })
    expect(uri).to.have.property("host").to.be.equal(targetIntf.host)
    expect(uri).to.have.property("port").to.be.equal(targetIntf.port)
    expect(uri)
      .to.have.property("transportParam")
      .to.be.equal(targetIntf.transport)
  })

  it("removes all loose routes(lr)", () => {
    const r = A.removeSelfRoutes(request)
    expect(r.message.route).to.be.lengthOf(1)
    const uri = r.message.route[0].address?.uri
    expect(uri).to.be.have.property("host").to.be.equal("10.100.42.128")
    expect(uri).to.be.have.property("port").to.be.equal(5060)
  })

  it("keeps a Route on a transport the EdgePort doesn't listen on", () => {
    // A copy: the fixture is shared by the whole mocha process
    const req = H.deepCopy(request)
    req.message.route[0].address.uri.transportParam = Transport.TLS
    const before = H.deepCopy(req)

    const r = A.removeSelfRoutes(req)

    expect(r.message.route).to.be.lengthOf(2)
    const uri = r.message.route[0].address.uri
    expect(uri).to.have.property("host").to.be.equal("10.100.42.127")
    expect(uri).to.have.property("transportParam").to.be.equal(Transport.TLS)
    expect(req).to.deep.equal(before)
  })

  it("applies the extension headers from Route", () => {
    const r = A.applyXHeaders(route)(request)
    expect(E.getHeaderValue(r, CT.ExtraHeader.GATEWAY_AUTH)).to.not.be.null
    expect(E.getHeaderValue(r, "user-agent")).to.be.null
  })

  it("removes the canonical X-Edgeport-Ref extension", () => {
    const withHeader = A.addXEdgePortRef(request)
    expect(E.getHeaderValue(withHeader, CT.ExtraHeader.EDGEPORT_REF)).to.equal(
      request.edgePortRef
    )

    const cleaned = A.removeXEdgePortRef(withHeader)
    expect(E.getHeaderValue(cleaned, CT.ExtraHeader.EDGEPORT_REF)).to.be.null
    expect(cleaned.message.extensions.find((ext) => ext.name === "CSeq")).to
      .exist
  })

  it("strips X-Edgeport-Ref regardless of header-name case", () => {
    const req = {
      ...request,
      message: {
        ...request.message,
        extensions: [
          ...request.message.extensions,
          { name: "x-edgeport-ref", value: "edgeport-01" }
        ]
      }
    }
    const cleaned = A.removeXEdgePortRef(req)
    expect(E.getHeaderValue(cleaned, CT.ExtraHeader.EDGEPORT_REF)).to.be.null
  })

  it("replaces (not appends) a caller-supplied copy of an added header", () => {
    const req = {
      ...request,
      message: {
        ...request.message,
        extensions: [
          ...request.message.extensions,
          { name: "x-room-id", value: "spoofed" }
        ]
      }
    }
    const r = A.applyXHeaders({
      ...route,
      headers: [
        {
          name: "X-Room-Id",
          value: "jsa-shqm-iyo",
          action: CT.HeaderModifierAction.ADD
        }
      ]
    })(req)
    const copies = r.message.extensions.filter(
      (ext) => ext.name.toLowerCase() === "x-room-id"
    )
    expect(copies).to.be.lengthOf(1)
    expect(copies[0].value).to.equal("jsa-shqm-iyo")
  })

  it("keeps every copy Routr itself adds under the same name", () => {
    const r = A.applyXHeaders({
      ...route,
      headers: [
        { name: "X-Tag", value: "a", action: CT.HeaderModifierAction.ADD },
        { name: "X-Tag", value: "b", action: CT.HeaderModifierAction.ADD }
      ]
    })(request)
    const values = r.message.extensions
      .filter((ext) => ext.name === "X-Tag")
      .map((ext) => ext.value)
    expect(values).to.deep.equal(["a", "b"])
  })

  it("removes a list of headers regardless of header-name case", () => {
    const req = {
      ...request,
      message: {
        ...request.message,
        extensions: [
          ...request.message.extensions,
          { name: "x-app-ref", value: "app-01" },
          { name: "X-ACCESS-KEY-ID", value: "WO00000000" }
        ]
      }
    }
    const r = A.removeHeaders(["X-App-Ref", "X-Access-Key-Id"])(req)
    expect(E.getHeaderValue(r, "X-App-Ref")).to.be.null
    expect(E.getHeaderValue(r, "X-Access-Key-Id")).to.be.null
    expect(r.message.extensions.find((ext) => ext.name === "CSeq")).to.exist
    // An empty list is a no-op
    expect(A.removeHeaders([])(req)).to.equal(req)
  })

  it("pipes alterations and checks the result", () => {
    const result = pipe(
      request,
      A.fixRequestURI(route),
      A.addSelfVia(route),
      A.decreaseMaxForwards
    )
    expect(result).to.have.property("message")
  })

  it("converts 'From' and 'To' headers to e164 format", () => {
    const req = createPSTNMessage(request, {
      from: "17853178071",
      to: "46721895538"
    })
    const r = A.normalizeToE164(true)(req)
    expect(r).to.have.property("message")
    expect(r.message.from.address.uri.user).to.be.equal("+17853178071")
    expect(r.message.to.address.uri.user).to.be.equal("+46721895538")
    expect(r.message.requestUri.user).to.be.equal("+46721895538")
  })

  it("converts the 'To' header to e164 format and leaves 'From' header unchanged", () => {
    const req = createPSTNMessage(request, {
      from: "1001",
      to: "46721895538"
    })
    const r = A.normalizeToE164(true)(req)
    expect(r).to.have.property("message")
    expect(r.message.from.address.uri.user).to.be.equal("1001")
    expect(r.message.to.address.uri.user).to.be.equal("+46721895538")
    expect(r.message.requestUri.user).to.be.equal("+46721895538")
  })

  it("normalizes a landline in every header, From included", () => {
    // A French landline (01): it has no mobile prefix, which the old check on
    // From required, so a business line calling in kept its bare digits
    const req = createPSTNMessage(request, {
      from: "33183646565",
      to: "33183646566"
    })
    const r = A.normalizeToE164(true)(req)
    expect(r.message.from.address.uri.user).to.be.equal("+33183646565")
    expect(r.message.to.address.uri.user).to.be.equal("+33183646566")
    expect(r.message.requestUri.user).to.be.equal("+33183646566")
  })

  describe("per-Trunk caller identity", () => {
    const toTrunk = (rewriteFrom?: { user: string; host: string }) => ({
      ...route,
      rewriteFrom
    })

    it("presents the Number as the caller at the given domain", () => {
      const r = A.rewriteFromWithNumber(
        toTrunk({ user: "+18295863314", host: "sip.provider.net" })
      )(request)
      const from = r.message.from
      expect(from.address.uri.user).to.equal("+18295863314")
      expect(from.address.uri.host).to.equal("sip.provider.net")
      expect(from.address.uri.userParam).to.equal("phone")
      // Tag and display name stay, so the dialog is the same one
      expect(from.tag).to.equal(request.message.from.tag)
      expect(from.address.displayName).to.equal("John Doe")
      // The input is not mutated
      expect(request.message.from.address.uri.user).to.equal("1001")
    })

    it("uses whatever domain the route carries (fromDomain or the outbound host)", () => {
      const r = A.rewriteFromWithNumber(
        toTrunk({ user: "+18295863314", host: "wa.example.com" })
      )(request)
      expect(r.message.from.address.uri.host).to.equal("wa.example.com")
    })

    it("does nothing when the Trunk does not ask for it", () => {
      expect(A.rewriteFromWithNumber(toTrunk())(request)).to.equal(request)
    })

    it("never rewrites an anonymous From", () => {
      const anonymous = createPSTNMessage(request, {
        from: "anonymous",
        to: "17853178070"
      })
      anonymous.message.from.address.uri.host = "anonymous.invalid"
      const r = A.rewriteFromWithNumber(
        toTrunk({ user: "+18295863314", host: "sip.provider.net" })
      )(anonymous)
      expect(r.message.from.address.uri.user).to.equal("anonymous")
      expect(r.message.from.address.uri.host).to.equal("anonymous.invalid")
      expect(A.isAnonymous({ host: "anonymous.invalid" })).to.equal(true)
      expect(A.isAnonymous({ user: "Anonymous", host: "x.com" })).to.equal(true)
    })

    it("leaves the request alone when normalizeToE164 is off", () => {
      const req = createPSTNMessage(request, {
        from: "17853178071",
        to: "46721895538"
      })
      expect(A.normalizeToE164(false)(req)).to.equal(req)
    })

    it("records nothing in Record-Route when the identity did not change", () => {
      expect(A.identityRewriteParameters(request, request)).to.deep.equal({})
    })

    it("records the original and the new From in Record-Route", () => {
      const altered = A.rewriteFromWithNumber(
        toTrunk({ user: "+18295863314", host: "sip.provider.net" })
      )(request)
      const parameters = A.identityRewriteParameters(request, altered)
      // To moved to the Trunk's host, so it is recorded as well
      expect(parameters).to.have.keys("rfo", "rfn", "rco", "rcn")
      // Base64url: a SIP token, no quoting needed
      expect(parameters.rfo).to.match(/^[A-Za-z0-9_-]+$/)
      // With the port, when the URI names one
      expect(Buffer.from(parameters.rfo, "base64url").toString()).to.equal(
        "1001@sip.local:5060"
      )
      expect(Buffer.from(parameters.rfn, "base64url").toString()).to.equal(
        "+18295863314@sip.provider.net;user=phone"
      )

      const r = A.addSelfRecordRoute(route, parameters)(altered)
      // Every entry this EdgePort added, and none of the ones already there
      const added =
        r.message.recordRoute.length - altered.message.recordRoute.length
      expect(added).to.be.greaterThan(0)
      expect(r.message.recordRoute[added].address.uri.user ?? "").to.not.match(
        /^rfo\./
      )
      // In the URI user part, which a user agent keeps (RFC 3261 section
      // 12.1.2), and not as header parameters, which it may drop
      r.message.recordRoute.slice(0, added).forEach((rr: CT.RecordRoute) => {
        expect(rr.address.uri.user).to.equal(
          `rfo.${parameters.rfo}.rfn.${parameters.rfn}` +
            `.rco.${parameters.rco}.rcn.${parameters.rcn}`
        )
        expect(rr.parameters ?? {}).to.not.have.property("rfo")
      })
    })

    it("records a To normalized by normalizeToE164", () => {
      const req = createPSTNMessage(request, {
        from: "1001",
        to: "46721895538"
      })
      const parameters = A.identityRewriteParameters(
        req,
        A.normalizeToE164(true)(req)
      )
      expect(parameters).to.have.keys("rco", "rcn")
    })

    describe("in-dialog requests", () => {
      // A call to a callee other than the caller, so the From and To mappings
      // tell them apart
      const invite = createPSTNMessage(request, {
        from: "1001",
        to: "17853178070"
      })
      const rewritten = A.rewriteFromWithNumber(
        toTrunk({ user: "+18295863314", host: "sip.provider.net" })
      )(invite)
      const parameters = A.identityRewriteParameters(invite, rewritten)

      // An in-dialog request whose first Route entry is this EdgePort, stamped
      // by the INVITE that set up the dialog
      const inDialog = (from: CT.SipURI, to: CT.SipURI) => {
        const req = createPSTNMessage(request, { from: "x", to: "y" })
        req.message.from.address.uri = { ...from }
        req.message.to.address.uri = { ...to }
        req.message.route[0].parameters = { ...parameters }
        return req
      }

      const caller = invite.message.from.address.uri
      const number = rewritten.message.from.address.uri
      const callee = invite.message.to.address.uri

      it("gives a request from the caller the From the Trunk knows", () => {
        const r = A.swapIdentityFromRouteSet(inDialog(caller, callee))
        expect(r.message.from.address.uri.user).to.equal("+18295863314")
        expect(r.message.from.address.uri.host).to.equal("sip.provider.net")
        expect(r.message.from.address.uri.userParam).to.equal("phone")
      })

      it("gives a request from the Trunk the caller's own identity in To", () => {
        const r = A.swapIdentityFromRouteSet(inDialog(callee, number))
        expect(r.message.to.address.uri.user).to.equal("1001")
        expect(r.message.to.address.uri.host).to.equal("sip.local")
        expect(r.message.to.address.uri.userParam).to.equal(undefined)
      })

      it("leaves a To the Trunk did not get from Routr alone", () => {
        // A carrier that answers with the caller's original identity in To
        const r = A.swapIdentityFromRouteSet(inDialog(callee, caller))
        expect(r.message.to.address.uri.user).to.equal("1001")
        expect(r.message.to.address.uri.host).to.equal("sip.local")
      })

      it("ignores the mapping on a Route entry of another EdgePort", () => {
        const req = inDialog(caller, callee)
        req.message.route[0].address.uri.host = "192.0.2.10"
        const r = A.swapIdentityFromRouteSet(req)
        expect(r.message.from.address.uri.user).to.equal("1001")
      })
    })
  })

  it("adds the via header using the route headers to calculate the egress interface", () => {
    const req = A.addSelfViaUsingTheRouteHeaders(request)
    expect(req).to.have.property("message")
    expect(req.message.via).to.be.lengthOf(3)
    expect(req.message.via[0].host).to.be.equal("10.100.42.128")
    expect(req.message.via[0].port).to.be.equal(5060)
    expect(req.message.via[0].transport).to.be.equal(Transport.TCP)
  })
})

// The cases of internal/connect/crossed_dialog_test.go and the Go SDK's
// peer_test.go: two EdgePorts behind one load balancer, each with its pod IP
// and the pod range as its localnet, the caller's TCP connection on B and the
// callee's UDP binding on A.
describe("@routr/processor/alterations across EdgePorts", () => {
  const LB = "200.22.21.42"
  const A_IP = "10.244.1.11"
  const B_IP = "10.244.2.12"
  const CALLER = "198.51.100.10"
  const CALLEE = "198.51.100.20"

  const listeningPoints = () => [
    { host: "0.0.0.0", port: 5060, transport: Transport.TCP },
    { host: "0.0.0.0", port: 5060, transport: Transport.UDP }
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onEdgePort = (req: any, ref: string, ip: string, sender: any) => {
    req.edgePortRef = ref
    req.localnets = [`${ip}/16`]
    req.externalAddrs = [LB]
    req.listeningPoints = listeningPoints()
    req.sender = sender
    return req
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calleeOnA = (): any => ({
    user: "1002",
    host: CALLEE,
    port: 40000,
    advertisedHost: CALLEE,
    advertisedPort: 40000,
    transport: Transport.UDP,
    sessionCount: -1,
    registeredOn: 1761255805000,
    edgePortRef: "edgeport-a",
    listeningPoints: listeningPoints(),
    localnets: [`${A_IP}/16`],
    externalAddrs: [LB]
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invite = (): any =>
    onEdgePort(
      {
        ref: "crossed-call",
        method: "INVITE",
        message: {
          messageType: CT.MessageType.REQUEST,
          requestUri: {
            user: "1002",
            host: "sip.local",
            port: 5060,
            transportParam: Transport.TCP
          },
          via: [
            {
              host: CALLER,
              port: 50000,
              transport: Transport.TCP,
              rPort: -1
            }
          ],
          from: {
            address: { uri: { user: "1001", host: "sip.local" } },
            tag: "caller-tag"
          },
          to: { address: { uri: { user: "1002", host: "sip.local" } } },
          maxForwards: { maxForwards: 70 },
          route: [],
          recordRoute: [],
          extensions: []
        }
      },
      "edgeport-b",
      B_IP,
      { host: CALLER, port: 50000, transport: Transport.TCP }
    )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hops = (entries: any[]) =>
    entries.map(
      (e) =>
        `${e.address.uri.host}:${e.address.uri.port};${e.address.uri.transportParam}`
    )

  const isTrustedPeer = (req: MessageRequest) =>
    IpUtils.hasIp("10.244.0.0/16", Helper.sourceAddress(req))

  it("takes the source address from received, else the Via host", () => {
    const req = invite()
    expect(Helper.sourceAddress(req)).to.equal(CALLER)
    req.message.via[0].received = B_IP
    expect(Helper.sourceAddress(req)).to.equal(B_IP)
    req.message.via = []
    expect(Helper.sourceAddress(req)).to.equal("")
  })

  it("builds the route of a request from a peer from its Request-URI", () => {
    const req = invite()
    req.message.requestUri = { user: "1002", host: CALLEE, port: 40000 }
    req.message.via[0].host = LB
    const r = Helper.createRouteFromPeer(req)
    expect(r).to.include({
      user: "1002",
      host: CALLEE,
      port: 40000,
      advertisedHost: LB,
      transport: Transport.TCP,
      edgePortRef: "edgeport-b",
      expires: 3600,
      sessionCount: -1
    })
    req.message.requestUri.transportParam = Transport.UDP
    expect(Helper.createRouteFromPeer(req).transport).to.equal(Transport.UDP)
  })

  describe("addRouteToPeerEdgePortOwnAddress", () => {
    it("routes to the peer's own address on a shared localnet", () => {
      const out = A.addRouteToPeerEdgePortOwnAddress(calleeOnA())(invite())
      expect(hops(out.message.route)).to.deep.equal([`${A_IP}:5060;UDP`])
      expect(out.message.route[0].address.uri.lrParam).to.be.true
    })

    it("routes as addRouteToPeerEdgePort without a shared localnet", () => {
      ;[["192.168.7.7/24"], ["127.0.0.1/8"], ["10.244.0.0/16"]].forEach(
        (localnets) => {
          const r = { ...calleeOnA(), localnets }
          const out = A.addRouteToPeerEdgePortOwnAddress(r)(invite())
          const old = A.addRouteToPeerEdgePort(r)(invite())
          expect(out).to.deep.equal(old)
          expect(hops(out.message.route)).to.deep.equal([`${LB}:5060;UDP`])
        }
      )
    })

    it("throws for a transport the peer doesn't listen on", () => {
      const r = { ...calleeOnA(), transport: Transport.TLS }
      const req = invite()
      expect(() => A.addRouteToPeerEdgePortOwnAddress(r)(req)).to.throw()
      expect(req.message.route).to.be.lengthOf(0)
    })
  })

  describe("addSelfViaTowardNextHop", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inDialog = (lps = listeningPoints()): any => {
      const req = invite()
      req.method = "BYE"
      req.message.requestUri = { user: "1002", host: CALLEE, port: 40000 }
      req.listeningPoints = lps
      return req
    }

    it("puts a request from a peer on the sender's transport", () => {
      const out = A.addSelfViaTowardNextHop(true)(inDialog())
      expect(out.message.via[0]).to.include({
        host: LB,
        port: 5060,
        transport: Transport.TCP,
        rPortFlag: true
      })
    })

    it("uses UDP when not from a peer, as addSelfViaUsingExternalAddrs", () => {
      const out = A.addSelfViaTowardNextHop(false)(inDialog())
      expect(out.message.via[0].transport).to.equal(Transport.UDP)
      expect(out).to.deep.equal(A.addSelfViaUsingExternalAddrs(inDialog()))
    })

    it("uses the sender's transport on an EdgePort without UDP", () => {
      const tcpOnly = [
        { host: "0.0.0.0", port: 5060, transport: Transport.TCP }
      ]
      const out = A.addSelfViaTowardNextHop(false)(inDialog(tcpOnly))
      expect(out.message.via[0].transport).to.equal(Transport.TCP)
      expect(() => A.addSelfViaUsingExternalAddrs(inDialog(tcpOnly))).to.throw()
    })

    it("faces a peer's own address on top of the route set", () => {
      const req = inDialog()
      req.message.route = [
        {
          address: {
            uri: {
              host: A_IP,
              port: 5060,
              transportParam: Transport.UDP,
              lrParam: true
            }
          }
        }
      ]
      const out = A.addSelfViaTowardNextHop(false)(req)
      expect(out.message.via[0]).to.include({
        host: B_IP,
        transport: Transport.UDP
      })
      req.message.route[0].address.uri.port = 5070
      const other = A.addSelfViaTowardNextHop(false)(req)
      expect(other.message.via[0].host).to.equal(LB)
    })
  })

  describe("addSelfRecordRouteFromPeer", () => {
    const atA = () =>
      onEdgePort(invite(), "edgeport-a", A_IP, {
        host: LB,
        port: 5060,
        transport: Transport.UDP
      })
    const r = () => ({ ...calleeOnA(), advertisedHost: LB })

    it("faces the peer with the origin entry", () => {
      const out = A.addSelfRecordRouteFromPeer(r(), {}, B_IP)(atA())
      expect(hops(out.message.recordRoute)).to.deep.equal([
        `${LB}:5060;UDP`,
        `${A_IP}:5060;UDP`
      ])
    })

    it("is addSelfRecordRoute without a peerSource", () => {
      const params = { rfo: "MTAwMUBzaXAubG9jYWw", rfn: "KzE4Mjk1ODYzMzE0" }
      ;[r(), calleeOnA(), route].forEach((rt) => {
        expect(A.addSelfRecordRouteFromPeer(rt, params)(atA())).to.deep.equal(
          A.addSelfRecordRoute(rt, params)(atA())
        )
      })
    })
  })

  describe("addSelfRecordRouteToPeer", () => {
    it("records this EdgePort's own address facing the peer", () => {
      const out = A.addSelfRecordRouteToPeer(calleeOnA())(invite())
      expect(hops(out.message.recordRoute)).to.deep.equal([
        `${B_IP}:5060;UDP`,
        `${LB}:5060;TCP`
      ])
      out.message.recordRoute.forEach((e: CT.RecordRoute) =>
        expect(e.parameters).to.deep.equal({ r2: "on" })
      )
    })

    it("is addSelfRecordRoute without a peer on a shared localnet", () => {
      ;[["192.168.7.7/24"], ["127.0.0.1/8"]].forEach((localnets) => {
        const r = { ...calleeOnA(), localnets, advertisedHost: "10.244.42.9" }
        expect(A.addSelfRecordRouteToPeer(r)(invite())).to.deep.equal(
          A.addSelfRecordRoute(r)(invite())
        )
      })
    })
  })

  describe("removeRoutesUpToOwn", () => {
    const entry = (host: string) => ({
      address: {
        uri: { host, port: 5060, transportParam: Transport.UDP, lrParam: true }
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const at = (localnets: string[], hosts: string[]): any => ({
      ...invite(),
      localnets,
      externalAddrs: [LB],
      message: { ...invite().message, route: hosts.map(entry) }
    })

    it("drops everything up to the last entry with this EdgePort's own address", () => {
      const out = A.removeRoutesUpToOwn(
        at([`${A_IP}/16`], [LB, B_IP, A_IP, LB, "203.0.113.9"])
      )
      expect(hops(out.message.route)).to.deep.equal([
        `${LB}:5060;UDP`,
        "203.0.113.9:5060;UDP"
      ])
    })

    it("leaves a route set without one alone", () => {
      const req = at([`${A_IP}/16`], [LB, B_IP])
      expect(A.removeRoutesUpToOwn(req)).to.equal(req)
    })

    it("doesn't take a network-form localnet for this EdgePort's address", () => {
      const req = at(["10.244.0.0/16"], ["10.244.0.0", B_IP])
      expect(A.removeRoutesUpToOwn(req)).to.equal(req)
    })
  })

  it("routes a dialog that crossed EdgePorts as Connect does", () => {
    // B forwards the INVITE to A (Connect's toPeerEdgePort)
    const callee = calleeOnA()
    const atB = pipe(
      invite(),
      A.removeSelfRoutes,
      A.fixRequestURI(callee),
      A.addSelfVia(callee),
      A.addSelfRecordRouteToPeer(callee),
      A.addRouteToNextHop(callee),
      A.addRouteToPeerEdgePortOwnAddress(callee),
      A.addXEdgePortRef,
      A.decreaseMaxForwards
    )
    expect(hops(atB.message.route)).to.deep.equal([`${A_IP}:5060;UDP`])

    // A receives it from B and sends it to the callee
    const received = H.deepCopy(atB)
    delete received.message.requestUri.transportParam
    const via = received.message.via[0]
    onEdgePort(received, "edgeport-a", A_IP, {
      host: via.host,
      port: via.port,
      transport: Transport.UDP
    })
    via.received = B_IP
    expect(isTrustedPeer(received)).to.be.true
    const source = Helper.sourceAddress(received)
    const r = Helper.createRouteFromPeer(received)
    const atA = pipe(
      received,
      A.decreaseMaxForwards,
      A.removeAuthorization,
      A.removeSelfRoutes,
      A.removeXEdgePortRef,
      A.fixRequestURI(r),
      A.addSelfVia(r),
      A.addSelfRecordRouteFromPeer(r, {}, source),
      A.addRouteToNextHop(r)
    )
    expect(atA.message.route).to.be.lengthOf(0)
    expect(atA.message.requestUri).to.include({
      host: CALLEE,
      transportParam: Transport.UDP
    })
    const rr = atA.message.recordRoute
    expect(hops(rr)).to.deep.equal([
      `${LB}:5060;UDP`,
      `${A_IP}:5060;UDP`,
      `${B_IP}:5060;UDP`,
      `${LB}:5060;TCP`
    ])

    // The callee's BYE lands on A, which doesn't hold the caller's connection
    const routeSet = rr.map((e: CT.RecordRoute) => ({
      address: { uri: { ...e.address.uri } }
    }))
    const bye = onEdgePort(
      {
        ref: "bye",
        method: "BYE",
        message: {
          ...invite().message,
          requestUri: {
            user: "1001",
            host: CALLER,
            port: 50000,
            transportParam: Transport.TCP
          },
          via: [{ host: CALLEE, port: 40000, transport: Transport.UDP }],
          route: routeSet
        }
      },
      "edgeport-a",
      A_IP,
      { host: CALLEE, port: 40000, transport: Transport.UDP }
    )
    const inDialog = (req: MessageRequest) =>
      pipe(
        req,
        A.decreaseMaxForwards,
        A.removeRoutesUpToOwn,
        A.removeSelfRoutes,
        A.addSelfViaTowardNextHop(isTrustedPeer(req))
      )
    const landed = inDialog(bye)
    expect(hops(landed.message.route)).to.deep.equal([`${B_IP}:5060;UDP`])
    expect(landed.message.via[0]).to.include({
      host: A_IP,
      transport: Transport.UDP
    })

    // B holds it and sends it to the caller
    const atHolder = onEdgePort(H.deepCopy(landed), "edgeport-b", B_IP, {
      host: A_IP,
      port: 5060,
      transport: Transport.UDP
    })
    const out = inDialog(atHolder)
    expect(out.message.route).to.be.lengthOf(0)
    expect(out.message.via[0]).to.include({
      host: LB,
      transport: Transport.TCP
    })
  })

  // A localnet written as a network (the pod range) names no interface: the
  // Go SDK and Connect never write its address, and neither do these
  describe("with a network-form localnet", () => {
    const POD_RANGE = "10.244.0.0/16"
    const NETWORK = "10.244.0.0"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onRange = (req: any) => {
      req.localnets = [POD_RANGE]
      return req
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hosts = (entries: any[]) => entries.map((e) => e.address.uri.host)

    it("addSelfRecordRouteFromPeer faces the peer from the external address", () => {
      const req = onRange(
        onEdgePort(invite(), "edgeport-a", A_IP, {
          host: "10.244.1.7",
          port: 5060,
          transport: Transport.UDP
        })
      )
      const r = { ...calleeOnA(), advertisedHost: "198.51.100.5" }
      const out = A.addSelfRecordRouteFromPeer(r, {}, "10.244.1.7")(req)
      expect(hosts(out.message.recordRoute)).to.not.include(NETWORK)
      expect(hosts(out.message.recordRoute)).to.deep.equal([LB])
    })

    it("addSelfRecordRouteToPeer writes no network address in the origin entry", () => {
      const req = onRange(invite())
      req.sender = { host: "10.244.9.9", port: 5060, transport: Transport.UDP }
      const out = A.addSelfRecordRouteToPeer({
        ...calleeOnA(),
        localnets: ["192.168.7.7/24"]
      })(req)
      expect(hosts(out.message.recordRoute)).to.not.include(NETWORK)
    })

    it("addSelfViaTowardNextHop writes no network address in the Via", () => {
      const req = onRange(invite())
      req.method = "BYE"
      req.message.requestUri = { user: "1002", host: "10.244.1.20", port: 5060 }
      const out = A.addSelfViaTowardNextHop(true)(req)
      expect(out.message.via[0].host).to.equal(LB)
    })

    it("addRouteToPeerEdgePortOwnAddress writes no network address in the Route", () => {
      const r = {
        ...calleeOnA(),
        host: "10.244.1.20",
        localnets: [POD_RANGE]
      }
      const out = A.addRouteToPeerEdgePortOwnAddress(r)(invite())
      expect(hosts(out.message.route)).to.deep.equal([LB])
    })
  })
})

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
import { CommonTypes as CT, Transport } from "@routr/common"
import { Alterations as A, Extensions as E } from "../src"
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
    const r = A.enforceE164(true, false)(req)
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
    const r = A.enforceE164(true, false)(req)
    expect(r).to.have.property("message")
    expect(r.message.from.address.uri.user).to.be.equal("1001")
    expect(r.message.to.address.uri.user).to.be.equal("+46721895538")
    expect(r.message.requestUri.user).to.be.equal("+46721895538")
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

    it("leaves the request alone when enforceE164 is off", () => {
      const req = createPSTNMessage(request, {
        from: "17853178071",
        to: "46721895538"
      })
      expect(A.enforceE164(false, false)(req)).to.equal(req)
    })

    it("records nothing in Record-Route when the identity did not change", () => {
      expect(A.identityRewriteParameters(request, request)).to.deep.equal({})
    })

    it("records the original and the new From in Record-Route", () => {
      const altered = A.rewriteFromWithNumber(
        toTrunk({ user: "+18295863314", host: "sip.provider.net" })
      )(request)
      const parameters = A.identityRewriteParameters(request, altered)
      expect(parameters).to.have.keys("rfo", "rfn")
      // Base64url: a SIP token, no quoting needed
      expect(parameters.rfo).to.match(/^[A-Za-z0-9_-]+$/)
      expect(Buffer.from(parameters.rfo, "base64url").toString()).to.equal(
        "1001@sip.local"
      )
      expect(Buffer.from(parameters.rfn, "base64url").toString()).to.equal(
        "+18295863314@sip.provider.net;user=phone"
      )

      const r = A.addSelfRecordRoute(route, parameters)(altered)
      // Every entry this EdgePort added, and none of the ones already there
      const added =
        r.message.recordRoute.length - altered.message.recordRoute.length
      expect(added).to.be.greaterThan(0)
      expect(r.message.recordRoute[added].parameters).to.not.have.property(
        "rfo"
      )
      r.message.recordRoute
        .slice(0, added)
        .forEach((rr: CT.RecordRoute) =>
          expect(rr.parameters).to.include({ rfo: parameters.rfo })
        )
    })

    it("records a To normalized by enforceE164", () => {
      const req = createPSTNMessage(request, {
        from: "1001",
        to: "46721895538"
      })
      const parameters = A.identityRewriteParameters(
        req,
        A.enforceE164(true, false)(req)
      )
      expect(parameters).to.have.keys("rco", "rcn")
    })

    describe("in-dialog requests", () => {
      const rewritten = A.rewriteFromWithNumber(
        toTrunk({ user: "+18295863314", host: "sip.provider.net" })
      )(request)
      const parameters = A.identityRewriteParameters(request, rewritten)

      // An in-dialog request whose first Route entry is this EdgePort, stamped
      // by the INVITE that set up the dialog
      const inDialog = (from: CT.SipURI, to: CT.SipURI) => {
        const req = createPSTNMessage(request, { from: "x", to: "y" })
        req.message.from.address.uri = { ...from }
        req.message.to.address.uri = { ...to }
        req.message.route[0].parameters = { ...parameters }
        return req
      }

      const caller = request.message.from.address.uri
      const number = rewritten.message.from.address.uri
      const callee = request.message.to.address.uri

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

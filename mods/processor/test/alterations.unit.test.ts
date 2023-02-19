/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
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
    const r = A.updateRequestURI(route)(request)
    expect(r)
      .to.have.property("message")
      .to.have.property("requestUri")
      .to.have.property("user")
      .to.be.equal(route.user)
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

  it("updates the request uri but removes user", () => {
    const ro = { ...route }
    delete ro.user

    const r = A.updateRequestURI(ro)(request)
    expect(r)
      .to.have.property("message")
      .to.have.property("requestUri")
      .to.have.property("user").to.be.null
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

  it("pipes alterations and checks the result", () => {
    const result = pipe(
      request,
      A.updateRequestURI(route),
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
    const enforceE164 = A.enforceE164(true, false)
    const r = enforceE164(req)
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
    const enforceE164 = A.enforceE164(true, false)
    const r = enforceE164(req)
    expect(r).to.have.property("message")
    expect(r.message.from.address.uri.user).to.be.equal("1001")
    expect(r.message.to.address.uri.user).to.be.equal("+46721895538")
    expect(r.message.requestUri.user).to.be.equal("+46721895538")
  })
})

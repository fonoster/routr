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
import { request, route } from "@routr/processor/test/examples"
import {
  MessageRequest,
  Method,
  Route,
  Transport,
  CommonTypes,
  Helper
} from "@routr/common"
import { handleRegister } from "../src/handlers/register"
import { Extensions as E, Response } from "@routr/processor"
import { Helper as H } from "@routr/location"
import { createRequest, r1 } from "./examples"
import { router } from "../src/router"
import { apiClient, locationAPI } from "./mock_apis"
import { findResource } from "../src/utils"
import { ILocationService } from "@routr/location"
import { handleRequest } from "../src/handlers/request"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/connect", () => {
  afterEach(() => sandbox.restore())

  it("updates a request for inter-domain routing", () => {
    // Test tailor method
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tailor = require("../src/tailor").tailor
    const tailoredRequest = tailor(route as Route, request as MessageRequest)
    const tailerRequestUri = tailoredRequest.message.requestUri
    const messageRequestUri = tailoredRequest.message.requestUri

    expect(tailerRequestUri.user).to.equal(messageRequestUri.user)
    expect(tailerRequestUri.host).to.equal(messageRequestUri.host)
    expect(tailerRequestUri.port).to.equal(messageRequestUri.port)
    expect(tailoredRequest.message.via).to.be.lengthOf(3)
    expect(tailoredRequest.message.maxForwards.maxForwards).to.be.equal(69)
  })

  it("handles a register request", (done) => {
    const location = {
      addRoute: () => {
        // noop
      }
    }
    const addRoute = sandbox.spy(location, "addRoute")
    const response = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      sendRegisterOk: (_: MessageRequest) => {
        expect(addRoute).to.have.been.calledOnce
        done()
      }
    } as Response

    handleRegister(apiClient, location as unknown as ILocationService)(
      request,
      response
    )
  })

  it("handles a request from another edgeport", async () => {
    const req = E.addHeader(
      { ...request },
      {
        name: CommonTypes.ExtraHeader.EDGEPORT_REF,
        value: "xyz"
      }
    )
    const getHeaderValue = sandbox.spy(E, "getHeaderValue")
    const createRouteFromLastMessage = sandbox.spy(
      H,
      "createRouteFromLastMessage"
    )
    const location = { findRoutes: () => [route] }
    const findRoutes = sandbox.spy(location, "findRoutes")
    const response = {
      send: () => {
        // noop
      }
    } as unknown as Response

    await handleRequest(location as unknown as ILocationService)(req, response)

    expect(getHeaderValue).to.have.been.calledTwice
    expect(createRouteFromLastMessage).to.have.been.calledOnce
    expect(findRoutes).to.not.have.been.called
  })

  it("routes a CANCEL via the last-message fast path, without EDGEPORT_REF", async () => {
    // A CANCEL must follow the exact path its INVITE took (RFC 3261 §9.1). It should
    // never be routed as a new call, whether or not it happens to carry EDGEPORT_REF —
    // Asterisk sends it directly, so it never does.
    const req = { ...request, method: Method.CANCEL }
    const createRouteFromLastMessage = sandbox.spy(
      H,
      "createRouteFromLastMessage"
    )
    const location = { findRoutes: () => [route] }
    const findRoutes = sandbox.spy(location, "findRoutes")
    const response = {
      send: () => {
        // noop
      }
    } as unknown as Response

    await handleRequest(location as unknown as ILocationService)(req, response)

    expect(createRouteFromLastMessage).to.have.been.calledOnce
    expect(findRoutes).to.not.have.been.called
  })

  it("REGRESSION: a peer-to-pstn CANCEL with no X-Dod-Number is not rejected", async () => {
    // Reproduces the 2026-08-30 incident: Asterisk's CANCEL for a peer-to-pstn call
    // carries no X-Dod-Number — only the INVITE does — so routing it as a fresh call
    // hit peerToPSTN's required-header check and came back 400. The CANCEL was
    // dropped, the call kept ringing, and answering a moment later connected into a
    // line the caller had already abandoned. The equivalent INVITE is legitimately
    // rejected by the existing "returns Bad Request..." test below; this asserts the
    // CANCEL is not, because it must never reach that check at all.
    const req: MessageRequest = {
      ...createRequest({
        fromUser: "asterisk",
        fromDomain: "unknown.com",
        toUser: "+17853178070",
        toDomain: "unknown.com"
        // dodNumber intentionally omitted, as on Asterisk's real CANCEL
      }),
      method: Method.CANCEL
    }
    let sent: unknown
    const response = {
      send: (message: unknown) => {
        sent = message
      }
    } as unknown as Response

    await handleRequest(locationAPI, apiClient)(req, response)

    // A rejection comes back as { message: { responseType, reasonPhrase } }
    // (createBadRequestResponse); a forwarded CANCEL is a full MessageRequest, whose
    // .message is the SIP message itself and carries no responseType at all.
    expect(sent).to.have.property("message")
    expect(
      (sent as { message: { responseType?: string } }).message
    ).to.not.have.property("responseType")
  })

  it("handles a request from agent to agent in the same domain", async () => {
    const req = createRequest({
      fromDomain: "sip.local",
      fromUser: "1001",
      toDomain: "sip.local",
      toUser: "1002"
    })
    const result = await router(locationAPI, apiClient)(req)

    expect(result.route).to.be.not.null
    expect(result.route).to.have.property("user", r1.user)
    expect(result.route).to.have.property("host", r1.host)
    expect(result.route).to.not.have.property("headers")
  })

  it("handles a request from agent to pstn", async () => {
    const req = createRequest({
      fromUser: "1001",
      fromDomain: "sip.local",
      toUser: "17853178070",
      toDomain: "sip.local"
    })
    const result = await router(locationAPI, apiClient)(req)

    expect(result.route).to.be.not.null
    expect(result.route).to.have.property("user", "pbx-1")
    expect(result.route).to.have.property("host", "sip.provider.net")
    expect(result.route).to.have.property("port", 7060)
    expect(result.route).to.have.property("transport", Transport.UDP)
    expect(result.route)
      .to.have.property("headers")
      .to.be.an("array")
      .lengthOf(5)
  })

  it("handles a request from pstn to agent or peer", async () => {
    const req = createRequest({
      fromUser: "+19195551212",
      fromDomain: "newyork1.voip.ms",
      toUser: "+17066041487",
      toDomain: "newyork1.voip.ms",
      requestUriHost: "trunk01.acme.com"
    })
    const result = await router(locationAPI, apiClient)(req)

    expect(result.route).to.be.not.null
    expect(result.route).to.have.property("user", r1.user)
    expect(result.route).to.have.property("host", r1.host)
    expect(result.route).to.have.property("port", r1.port)
    expect(result.route).to.have.property("transport", r1.transport)
    expect(result.route)
      .to.have.property("headers")
      .to.be.an("array")
      .lengthOf(1)
  })

  it("handles a request from peer to pstn", async () => {
    const req = createRequest({
      fromUser: "asterisk",
      fromDomain: "unknown.com",
      toUser: "+17853178070",
      toDomain: "unknown.com",
      dodNumber: "+18095863314"
    })
    const reqWithUpdatedAuth = Helper.deepCopy(req)
    reqWithUpdatedAuth.message.authorization.response =
      "09f30fe20face5e168ca7dafcbf154c0"

    const result = await router(locationAPI, apiClient)(reqWithUpdatedAuth)

    expect(result.route).to.be.not.null
    expect(result.route)
      .to.have.property("headers")
      .to.be.an("array")
      .lengthOf(5)
  })

  it("returns Bad Request when X-Dod-Number is missing for peer to pstn", async () => {
    const req = createRequest({
      fromUser: "asterisk",
      fromDomain: "unknown.com",
      toUser: "+17853178070",
      toDomain: "unknown.com"
      // dodNumber intentionally omitted
    })
    const reqWithUpdatedAuth = Helper.deepCopy(req)
    reqWithUpdatedAuth.message.authorization.response =
      "09f30fe20face5e168ca7dafcbf154c0"

    const result = await router(locationAPI, apiClient)(reqWithUpdatedAuth)

    expect(result).to.not.have.property("direction")
    expect(result)
      .to.have.property("message")
      .to.have.property("responseType", CommonTypes.ResponseType.BAD_REQUEST)
  })

  it("returns Not Found when the X-Dod-Number resource does not exist", async () => {
    const req = createRequest({
      fromUser: "asterisk",
      fromDomain: "unknown.com",
      toUser: "+17853178070",
      toDomain: "unknown.com",
      dodNumber: "+10000000000"
    })
    const reqWithUpdatedAuth = Helper.deepCopy(req)
    reqWithUpdatedAuth.message.authorization.response =
      "09f30fe20face5e168ca7dafcbf154c0"

    const result = await router(locationAPI, apiClient)(reqWithUpdatedAuth)

    expect(result).to.not.have.property("direction")
    expect(result)
      .to.have.property("message")
      .to.have.property("responseType", CommonTypes.ResponseType.NOT_FOUND)
  })

  it("gets resource by domainUri and userpart", async () => {
    const r1 = await findResource(apiClient, "sip.local", "1001")
    // Domain with xxx reference does not exist
    const r2 = await findResource(apiClient, "sip.local2", "+17066041487")
    const r3 = await findResource(apiClient, "sip.localx", "1001")
    expect(r1).to.have.property("username", "1001")
    expect(r2).to.have.property("telUrl", "tel:+17066041487")
    expect(r3).to.not.exist
  })
})

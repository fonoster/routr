/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
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
import { request, route } from "@routr/processor/test/examples"
import { MessageRequest, Route, Transport } from "@routr/common"
import { handleRegister, handleRequest } from "../src/handlers"
import { Extensions as E, Helper as HE, Response } from "@routr/processor"
import { createRequest, r1 } from "./examples"
import { router } from "../src/router"
import { dataAPI, locationAPI } from "./mock_apis"
import { findResource } from "../src/utils"
import { ILocationService } from "@routr/location"

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
    expect(tailoredRequest.message.requestUri.user).to.equal(route.user)
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
      sendOk: () => {
        expect(addRoute).to.have.been.calledOnce
        done()
      }
    } as unknown as Response
    handleRegister(location as unknown as ILocationService)(request, response)
  })

  it("handles a request from another edgeport", async () => {
    const req = E.addHeader(
      { ...request },
      {
        name: "x-edgeport-ref",
        value: "xyz"
      }
    )
    const getHeaderValue = sandbox.spy(E, "getHeaderValue")
    const createRouteFromLastMessage = sandbox.spy(
      HE,
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

  it("handles a request from agent to agent in the same domain", async () => {
    const req = createRequest({
      fromDomain: "sip.local",
      fromUser: "1001",
      toDomain: "sip.local",
      toUser: "1002"
    })
    const route = await router(locationAPI, dataAPI)(req)
    expect(route).to.be.not.null
    expect(route).to.have.property("user", r1.user)
    expect(route).to.have.property("host", r1.host)
    expect(route).to.not.have.property("headers")
  })

  it("handles a request from agent to pstn", async () => {
    const req = createRequest({
      fromUser: "1001",
      fromDomain: "sip.local",
      toUser: "17853178070",
      toDomain: "sip.local"
    })
    const route = await router(locationAPI, dataAPI)(req)
    expect(route).to.be.not.null
    expect(route).to.have.property("user", "pbx-1")
    expect(route).to.have.property("host", "sip.provider.net")
    expect(route).to.have.property("port", 7060)
    expect(route).to.have.property("transport", Transport.UDP)
    expect(route).to.have.property("headers").to.be.an("array").lengthOf(3)
  })

  it("handles a request from pstn to agent or peer", async () => {
    const req = createRequest({
      fromUser: "9195551212",
      fromDomain: "newyork1.voip.ms",
      toUser: "17066041487",
      toDomain: "newyork1.voip.ms"
    })
    const route = await router(locationAPI, dataAPI)(req)
    expect(route).to.be.not.null
    expect(route).to.have.property("user", r1.user)
    expect(route).to.have.property("host", r1.host)
    expect(route).to.have.property("port", r1.port)
    expect(route).to.have.property("transport", r1.transport)
    expect(route).to.have.property("headers").to.be.an("array").lengthOf(1)
  })

  // TODO: Peer to PSTN must be done using the Connect Object
  it.skip("handles a request from peer to pstn", async () => {
    const req = createRequest({
      fromUser: "asterisk",
      fromDomain: "sip.local",
      toUser: "17853178070",
      toDomain: "sip.local"
    })
    const route = await router(locationAPI, dataAPI)(req)
    expect(route).to.be.not.null
    // Expects the user and host to correspond with the Gateway
    // Expects to have the asserted identity headers
  })

  it("gets resource by domainUri and userpart", async () => {
    const r1 = await findResource(dataAPI, "sip.local", "1001")
    // Domain with xxx reference does not exist
    const r2 = await findResource(dataAPI, "sip.local2", "17066041487")
    const r3 = await findResource(dataAPI, "sip.localx", "1001")
    expect(r1).to.have.property("kind", "Agent")
    expect(r2).to.have.property("kind", "Number")
    expect(r3).to.not.exist
  })
})

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
import { apiClient } from "./mock_apis"
import {
  agentCredentials,
  createAuthorization,
  createRequest,
  signAs
} from "./examples"
import { checkAccess, checkAgentOrPeerAccess } from "../src/access"
import { findResource } from "../src/utils"
import { handleRequest } from "../src/handlers/request"
import { handleRegister } from "../src/handlers/register"
import { createDispatcher } from "../src/service"
import { RoutingDirection } from "../src/types"
import { Auth, CommonConnect as CC, Method } from "@routr/common"
import { ILocationService } from "@routr/location"
import { Response } from "@routr/processor"
import { ResponseType } from "@routr/common/src/types"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/connect/challenge", () => {
  afterEach(() => sandbox.restore())

  const agentRequest = () =>
    createRequest({
      fromUser: "1001",
      fromDomain: "sip.local",
      toUser: "1002",
      toDomain: "sip.local"
    })

  const responseOf = (send: sinon.SinonStub) =>
    send.firstCall.args[0] as {
      message: {
        responseType: ResponseType
        wwwAuthenticate?: { stale: boolean }
      }
    }

  it("challenges an INVITE from an Agent before routing it", async () => {
    const req = agentRequest()
    req.message.authorization = undefined
    const location = { findRoutes: sandbox.stub().resolves([]) }
    const findNumber = sandbox.spy(apiClient.numbers, "findBy")
    const send = sandbox.stub()

    await handleRequest(location as unknown as ILocationService, apiClient)(
      req,
      { send } as unknown as Response
    )

    expect(responseOf(send).message.responseType).to.equal(
      ResponseType.UNAUTHORIZED
    )
    expect(responseOf(send).message.wwwAuthenticate?.stale).to.be.false
    expect(findNumber).to.not.have.been.called
    expect(location.findRoutes).to.not.have.been.called
  })

  it("routes an INVITE from a Trunk without a challenge", async () => {
    const req = createRequest({
      fromUser: "17853178070",
      fromDomain: "sip.provider.net",
      toUser: "18295863314",
      toDomain: "trunk02.acme.com",
      requestUriHost: "trunk02.acme.com"
    })
    req.message.authorization = undefined
    const location = { findRoutes: sandbox.stub().resolves([]) }
    const findNumber = sandbox.spy(apiClient.numbers, "findBy")
    const send = sandbox.stub()

    await handleRequest(location as unknown as ILocationService, apiClient)(
      req,
      { send } as unknown as Response
    )

    // Routing ran: the callee was looked up
    expect(findNumber).to.have.been.called
  })

  it("doesn't challenge an INVITE that carries a Connect Token", async () => {
    const req = agentRequest()
    req.message.authorization = undefined
    req.message.extensions.push({ name: "X-Connect-Token", value: "token" })
    const location = { findRoutes: sandbox.stub().resolves([]) }
    const send = sandbox.stub()

    await handleRequest(location as unknown as ILocationService, apiClient)(
      req,
      { send } as unknown as Response
    )

    // The token path answers for itself (no verifier here); no challenge
    expect(responseOf(send).message.responseType).to.not.equal(
      ResponseType.UNAUTHORIZED
    )
  })

  it("forwards a re-INVITE without credentials instead of challenging it", async () => {
    const req = agentRequest()
    req.message.authorization = undefined
    req.message.to.tag = "dialog-tag"
    const sent: { message: { responseType?: ResponseType } }[] = []
    const res = { send: (m: never) => sent.push(m) } as unknown as Response

    await createDispatcher({
      apiClient,
      location: { findRoutes: sandbox.stub().resolves([]) } as never
    })(req, res)

    expect(sent).to.have.lengthOf(1)
    expect(sent[0].message.responseType).to.be.undefined
  })

  it("requires a Peer calling an Agent to authenticate", async () => {
    const req = agentRequest()
    req.message.authorization = undefined

    const result = await checkAccess({
      apiClient,
      request: req,
      caller: { username: "asterisk" } as CC.Peer,
      callee: await findResource(apiClient, "sip.local", "1002"),
      routingDirection: RoutingDirection.PEER_TO_AGENT
    })

    expect(result)
      .to.have.property("message")
      .to.have.property("responseType", ResponseType.UNAUTHORIZED)
  })

  it("asks a REGISTER again, with stale, when its nonce has expired", async () => {
    const req = agentRequest()
    req.method = Method.REGISTER
    req.message.authorization = createAuthorization(
      Auth.generateNonce("MD5", () => Date.now() - 400 * 1000)
    )
    signAs(req, agentCredentials)
    const location = { addRoute: sandbox.stub().resolves() }
    const send = sandbox.stub()

    await handleRegister(apiClient, location as unknown as ILocationService)(
      req,
      { send } as unknown as Response
    )

    expect(responseOf(send).message.responseType).to.equal(
      ResponseType.UNAUTHORIZED
    )
    expect(responseOf(send).message.wwwAuthenticate?.stale).to.be.true
    expect(location.addRoute).to.not.have.been.called
  })

  it("requires an Agent calling a Peer to authenticate", async () => {
    const req = agentRequest()
    req.message.authorization = undefined
    const caller = await findResource(apiClient, "sip.local", "1001")

    const result = await checkAccess({
      apiClient,
      request: req,
      caller,
      callee: { username: "asterisk" } as CC.Peer,
      routingDirection: RoutingDirection.AGENT_TO_PEER
    })

    expect(result)
      .to.have.property("message")
      .to.have.property("responseType", ResponseType.UNAUTHORIZED)
  })

  it("asks again, with stale, when the credentials are right but the nonce has expired", async () => {
    const req = agentRequest()
    const fiveMinutesAgo = () => Date.now() - 400 * 1000
    req.message.authorization = createAuthorization(
      Auth.generateNonce("MD5", fiveMinutesAgo)
    )
    const caller = await findResource(apiClient, "sip.local", "1001")

    const result = (await checkAgentOrPeerAccess(req, caller)) as {
      message: {
        responseType: ResponseType
        wwwAuthenticate: { stale: boolean }
      }
    }

    expect(result.message.responseType).to.equal(ResponseType.UNAUTHORIZED)
    expect(result.message.wwwAuthenticate.stale).to.be.true
  })

  it("rejects wrong credentials without calling the nonce stale", async () => {
    const req = agentRequest()
    const fiveMinutesAgo = () => Date.now() - 400 * 1000
    req.message.authorization = {
      ...createAuthorization(Auth.generateNonce("MD5", fiveMinutesAgo)),
      response: "0000000000000000000000000000dead"
    }
    const caller = await findResource(apiClient, "sip.local", "1001")

    const result = (await checkAgentOrPeerAccess(req, caller)) as {
      message: {
        responseType: ResponseType
        wwwAuthenticate: { stale: boolean }
      }
    }

    expect(result.message.responseType).to.equal(ResponseType.UNAUTHORIZED)
    expect(result.message.wwwAuthenticate.stale).to.be.false
  })
})

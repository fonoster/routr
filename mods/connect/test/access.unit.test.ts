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
import { apiClient } from "./mock_apis"
import { findResource } from "../src/utils"
import { checkAccessFromPSTN, checkAgentOrPeerAccess } from "../src/access"
import { createRequest } from "./examples"
import { INumber } from "@routr/common/src/connect"
import { ResponseType } from "@routr/common/src/types"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/connect/access", () => {
  afterEach(() => sandbox.restore())

  it("checks if the agent is authorized to invite another agent", async () => {
    // Arrange
    const req = createRequest({
      fromUser: "1001",
      fromDomain: "sip.local",
      toUser: "1002",
      toDomain: "sip.local"
    })
    const fromURI = req.message.from.address.uri
    const caller = await findResource(
      apiClient,
      fromURI.host,
      fromURI.user as string
    )

    // Act
    const result = await checkAgentOrPeerAccess(req, caller)

    // Assert
    expect(result).to.be.undefined
  })

  it("returns an unauthorized response because it has no authorization header", async () => {
    // Arrange
    const req = createRequest({
      fromUser: "1001",
      fromDomain: "sip.local",
      toUser: "1002",
      toDomain: "sip.local"
    })
    req.message.authorization = undefined
    const fromURI = req.message.from.address.uri
    const caller = await findResource(
      apiClient,
      fromURI.host,
      fromURI.user as string
    )

    // Act
    const result = await checkAgentOrPeerAccess(req, caller)

    // Assert
    expect(result)
      .to.be.have.property("message")
      .to.have.property("responseType", ResponseType.UNAUTHORIZED)
  })

  it("allows request from pstn", async () => {
    // Arrange
    const req = createRequest({
      requestUriHost: "trunk01.acme.com",
      fromUser: "+17853178070",
      fromDomain: "newyork7.voip.ms",
      toUser: "+19103434434",
      toDomain: "newyork7.voip.ms"
    })
    const requestURI = req.message.requestUri
    const callee = await findResource(
      apiClient,
      requestURI?.host as string,
      requestURI?.user as string
    )

    // Act
    const result = await checkAccessFromPSTN(apiClient, req, callee as INumber)

    // Assert
    expect(result).to.be.undefined
  })

  it("declines request from pstn", async () => {
    // Arrange
    const req = createRequest({
      requestUriHost: "trunk02.acme.com",
      fromUser: "+17853178070",
      fromDomain: "newyork7.voip.ms",
      toUser: "+18295863314",
      toDomain: "newyork7.voip.ms"
    })
    const requestURI = req.message.requestUri
    const callee = await findResource(
      apiClient,
      requestURI?.host as string,
      requestURI?.user as string
    )

    // Act
    const result = await checkAccessFromPSTN(apiClient, req, callee as INumber)

    // Assert
    // It fails because the response in the authorization header doen't match the one from the API
    expect(result)
      .to.be.have.property("message")
      .to.have.property("responseType", ResponseType.UNAUTHORIZED)
  })
})

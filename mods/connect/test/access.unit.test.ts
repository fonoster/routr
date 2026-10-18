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
    // It fails because the response in the authorization header doesn't match the one from the API
    expect(result)
      .to.be.have.property("message")
      .to.have.property("responseType", ResponseType.UNAUTHORIZED)
  })
  describe("trunk access control list", () => {
    const createPSTNRequest = (via: { host: string; received?: string }) => {
      const req = createRequest({
        requestUriHost: "trunk01.acme.com",
        fromUser: "+17853178070",
        fromDomain: "newyork7.voip.ms",
        toUser: "+19103434434",
        toDomain: "newyork7.voip.ms"
      })
      req.message.via[0] = {
        ...req.message.via[0],
        received: undefined,
        ...via
      }
      // The EdgePort copies the sender from the top Via host
      req.sender = { ...req.sender, host: via.host }
      return req
    }

    const checkWithACL = async (req: ReturnType<typeof createRequest>) => {
      const requestURI = req.message.requestUri
      const callee = await findResource(
        apiClient,
        requestURI?.host as string,
        requestURI?.user as string
      )
      const trunk = (
        await apiClient.trunks.findBy({
          fieldName: "inboundUri",
          fieldValue: "trunk01.acme.com"
        })
      ).items[0]
      sandbox.stub(apiClient.trunks, "findBy").resolves({
        items: [
          {
            ...trunk,
            accessControlList: {
              ref: "acl-carrier",
              name: "Carrier",
              allow: ["203.0.113.0/24"],
              deny: ["0.0.0.0/0"]
            }
          }
        ]
      } as never)
      return checkAccessFromPSTN(apiClient, req, callee as INumber)
    }

    it("denies a forged Via host when received is outside the list", async () => {
      // Arrange
      const req = createPSTNRequest({
        host: "203.0.113.10",
        received: "198.51.100.7"
      })

      // Act
      const result = await checkWithACL(req)

      // Assert
      expect(result)
        .to.have.property("message")
        .to.have.property("responseType", ResponseType.UNAUTHORIZED)
    })

    it("allows the carrier address in received", async () => {
      // Arrange
      const req = createPSTNRequest({
        host: "10.0.0.5",
        received: "203.0.113.10"
      })

      // Act
      const result = await checkWithACL(req)

      // Assert
      expect(result).to.be.undefined
    })

    it("falls back to the Via host when received is absent", async () => {
      // Arrange
      const allowed = createPSTNRequest({ host: "203.0.113.10" })
      const denied = createPSTNRequest({ host: "198.51.100.7" })

      // Act
      const allowedResult = await checkWithACL(allowed)
      sandbox.restore()
      const deniedResult = await checkWithACL(denied)

      // Assert
      expect(allowedResult).to.be.undefined
      expect(deniedResult)
        .to.have.property("message")
        .to.have.property("responseType", ResponseType.UNAUTHORIZED)
    })
  })
})

/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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
import { TrunkManager } from "../src/mappers/trunk"
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"
import { Prisma } from "@prisma/client"
import chai from "chai"
import sinon from "sinon"
import chaiExclude from "chai-exclude"
import sinonChai from "sinon-chai"

const expect = chai.expect
chai.use(sinonChai)
chai.use(chaiExclude)
const sandbox = sinon.createSandbox()

describe("@routr/pgdata/mappers/trunk", () => {
  afterEach(() => sandbox.restore())

  it("takes a dto object and converts it to prisma model", () => {
    // Arrange
    const trunk = {
      apiVersion: CC.APIVersion.V2,
      ref: "trunk-01",
      name: "Global Trunk",
      accessControlListRef: "acl-01",
      inboundUri: "sip:sip.local",
      inboundCredentialsRef: "credentials-01",
      outboundCredentialsRef: "credentials-01",
      sendRegister: true,
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
      extended: {
        test: "test"
      }
    }

    // Act
    const result = new TrunkManager(trunk).mapToPrisma()

    // Assert
    expect(result)
      .excluding(["createdAt", "updatedAt", "uris"])
      .to.deep.equal(trunk)
  })

  it("takes a prisma model and converts it to dto object", () => {
    // Arrange
    type TrunkWithEagerLoading = Prisma.TrunkGetPayload<{
      include: {
        accessControlList: true
        inboundCredentials: true
        outboundCredentials: true
        uris: true
      }
    }>

    const trunk: TrunkWithEagerLoading = {
      apiVersion: CC.APIVersion.V2,
      ref: "trunk-01",
      name: "Global Trunk",
      accessControlListRef: "acl-01",
      inboundUri: "sip:sip.local",
      inboundCredentialsRef: "credentials-01",
      outboundCredentialsRef: "credentials-01",
      sendRegister: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      extended: {
        test: "test"
      },
      accessControlList: {
        apiVersion: CC.APIVersion.V2,
        ref: "acl-01",
        name: "Global ACL",
        allow: [""],
        deny: [""],
        createdAt: new Date(),
        updatedAt: new Date(),
        extended: {
          test: "test"
        }
      },
      inboundCredentials: {
        apiVersion: CC.APIVersion.V2,
        ref: "credentials-01",
        name: "test",
        username: "trunk01",
        password: "1234",
        createdAt: new Date(),
        updatedAt: new Date(),
        extended: {
          test: "test"
        }
      },
      outboundCredentials: {
        apiVersion: CC.APIVersion.V2,
        ref: "credentials-01",
        name: "test",
        username: "trunk01",
        password: "1234",
        createdAt: new Date(),
        updatedAt: new Date(),
        extended: {
          test: "test"
        }
      },
      uris: [
        {
          ref: "uri-01",
          trunkRef: "trunk-01",
          host: "sip.local",
          port: 5060,
          transport: "UDP" as CT.Transport,
          user: "test",
          weight: 1,
          priority: 1,
          enabled: true
        }
      ]
    }

    // Act
    const result = TrunkManager.mapToDto(trunk)

    // Assert
    expect(result)
      .excludingEvery(["createdAt", "updatedAt"])
      .to.deep.equal(trunk)
  })

  describe("throws errors", () => {
    it("when the friendly name is not provided for trunk creation", () => {
      // Arrange
      const trunk: Omit<CC.Trunk, "uris"> = {
        apiVersion: CC.APIVersion.V2,
        ref: "trunk-01",
        name: "",
        accessControlListRef: "acl-01",
        inboundUri: "sip:sip.local",
        inboundCredentialsRef: "credentials-01",
        outboundCredentialsRef: "credentials-01",
        sendRegister: true,
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
        extended: {
          test: "test"
        }
      }

      // Act
      const createResult = () => new TrunkManager(trunk).validOrThrowCreate()

      // Assert
      expect(createResult).to.throw(
        "the friendly name for the resource is required"
      )
    })

    it("when the friendly name has more than 60 characters", () => {
      // Arrange
      const trunk: Omit<CC.Trunk, "uris"> = {
        apiVersion: CC.APIVersion.V2,
        ref: "trunk-01",
        name: "a".repeat(65),
        accessControlListRef: "acl-01",
        inboundUri: "sip:sip.local",
        inboundCredentialsRef: "credentials-01",
        outboundCredentialsRef: "credentials-01",
        sendRegister: true,
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
        extended: {
          test: "test"
        }
      }

      // Act
      const updateResult = () => new TrunkManager(trunk).validOrThrowUpdate()
      const createResult = () => new TrunkManager(trunk).validOrThrowCreate()

      // Assert
      expect(updateResult).to.throw(
        "the friendly name must have less than 60 characters"
      )
      expect(createResult).to.throw(
        "the friendly name must have less than 60 characters"
      )
    })

    it("when the reference is not provided for an update operation", () => {
      // Arrange
      const trunk: Omit<CC.Trunk, "uris"> = {
        apiVersion: CC.APIVersion.V2,
        ref: "",
        name: "Global Trunk",
        accessControlListRef: "acl-01",
        inboundUri: "sip:sip.local",
        inboundCredentialsRef: "credentials-01",
        outboundCredentialsRef: "credentials-01",
        sendRegister: true,
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
        extended: {
          test: "test"
        }
      }

      // Act
      const result = () => new TrunkManager(trunk).validOrThrowUpdate()

      // Assert
      expect(result).to.throw("the reference to the resource is required")
    })

    // It is still not clear if we should make the inboundUri required
    it("when the request is missing the inboundUri", () => {
      // Arrange
      const trunk: CC.Trunk = {
        apiVersion: CC.APIVersion.V2,
        ref: "trunk-01",
        name: "Global Trunk",
        accessControlListRef: "acl-01",
        inboundUri: "",
        inboundCredentialsRef: "credentials-01",
        outboundCredentialsRef: "credentials-01",
        sendRegister: true,
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
        extended: {
          test: "test"
        }
      }

      // Act
      const result = () => new TrunkManager(trunk).validOrThrowCreate()

      // Assert
      expect(result).to.throw("the inboundUri is required")
    })

    it("when inboundUri is not a FQDN", () => {
      // Arrange
      const trunk: Omit<CC.Trunk, "uris"> = {
        apiVersion: CC.APIVersion.V2,
        ref: "trunk-01",
        name: "Global Trunk",
        accessControlListRef: "acl-01",
        inboundUri: "sip.acme.-com",
        inboundCredentialsRef: "credentials-01",
        outboundCredentialsRef: "credentials-01",
        sendRegister: true,
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
        extended: {
          test: "test"
        }
      }

      // Act
      const createResult = () => new TrunkManager(trunk).validOrThrowCreate()

      // Assert
      expect(createResult).to.throw(
        "the inbound URI must be a valid FQDN or IP address (e.g., sip.example.com or 47.132.130.31)"
      )
    })
  })
})

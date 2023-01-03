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
import { TrunkManager } from "../src/mappers/trunk"
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"
import { APIVersion, Prisma } from "@prisma/client"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/pgdata/mappers/trunk", () => {
  afterEach(() => sandbox.restore())

  it("takes a dto object and converts it to prisma model", () => {
    // Arrange
    const trunk: Omit<CC.Trunk, "uris"> = {
      apiVersion: "v2",
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
      }
    }

    // Act
    const result = new TrunkManager(trunk).mapToPrisma()

    // Assert
    expect(result).to.deep.equal(trunk)
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
      apiVersion: "v2" as APIVersion,
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
        apiVersion: "v2" as APIVersion,
        ref: "acl-01",
        name: "Global ACL",
        allow: [""],
        deny: [""],
        extended: {
          test: "test"
        }
      },
      inboundCredentials: {
        apiVersion: "v2" as APIVersion,
        ref: "credentials-01",
        name: "test",
        username: "trunk01",
        password: "1234",
        extended: {
          test: "test"
        }
      },
      outboundCredentials: {
        apiVersion: "v2" as APIVersion,
        ref: "credentials-01",
        name: "test",
        username: "trunk01",
        password: "1234",
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
    expect(result).to.deep.equal(trunk)
  })

  describe("throws errors", () => {
    it("when the friendly name is not provided for create or update operations", () => {
      // Arrange
      const trunk: Omit<CC.Trunk, "uris"> = {
        apiVersion: "v2",
        ref: "trunk-01",
        name: "",
        accessControlListRef: "acl-01",
        inboundUri: "sip:sip.local",
        inboundCredentialsRef: "credentials-01",
        outboundCredentialsRef: "credentials-01",
        sendRegister: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        extended: {
          test: "test"
        }
      }

      // Act
      const updateResult = () => new TrunkManager(trunk).validOrThrowUpdate()
      const createResult = () => new TrunkManager(trunk).validOrThrowCreate()

      // Assert
      expect(updateResult).to.throw(
        "the friendly name for the resource is required"
      )
      expect(createResult).to.throw(
        "the friendly name for the resource is required"
      )
    })

    it("when the friendly namy has less than 3 or more than 64 characters", () => {
      // Arrange
      const trunk: Omit<CC.Trunk, "uris"> = {
        apiVersion: "v2",
        ref: "trunk-01",
        name: "Gl",
        accessControlListRef: "acl-01",
        inboundUri: "sip:sip.local",
        inboundCredentialsRef: "credentials-01",
        outboundCredentialsRef: "credentials-01",
        sendRegister: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        extended: {
          test: "test"
        }
      }

      // Act
      const updateResult = () => new TrunkManager(trunk).validOrThrowUpdate()
      const createResult = () => new TrunkManager(trunk).validOrThrowCreate()

      // Assert
      expect(updateResult).to.throw(
        "the friendly name must be between 3 and 64 characters"
      )
      expect(createResult).to.throw(
        "the friendly name must be between 3 and 64 characters"
      )
    })

    it("when the reference is not provided for an update operation", () => {
      // Arrange
      const trunk: Omit<CC.Trunk, "uris"> = {
        apiVersion: "v2",
        ref: "",
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
        }
      }

      // Act
      const result = () => new TrunkManager(trunk).validOrThrowUpdate()

      // Assert
      expect(result).to.throw("the reference to the resource is required")
    })

    it("when the request is missing the inboundUri", () => {
      // Arrange
      const trunk: Omit<CC.Trunk, "uris"> = {
        apiVersion: "v2",
        ref: "trunk-01",
        name: "Global Trunk",
        accessControlListRef: "acl-01",
        inboundUri: "",
        inboundCredentialsRef: "credentials-01",
        outboundCredentialsRef: "credentials-01",
        sendRegister: true,
        createdAt: new Date(),
        updatedAt: new Date(),
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
        apiVersion: "v2",
        ref: "trunk-01",
        name: "Global Trunk",
        accessControlListRef: "acl-01",
        inboundUri: "sip.acme.-com",
        inboundCredentialsRef: "credentials-01",
        outboundCredentialsRef: "credentials-01",
        sendRegister: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        extended: {
          test: "test"
        }
      }

      // Act
      const createResult = () => new TrunkManager(trunk).validOrThrowCreate()
      const updateResult = () => new TrunkManager(trunk).validOrThrowUpdate()

      // Assert
      expect(createResult).to.throw(
        "the inbound URI must be a valid FQDN (e.g. sip.example.com)"
      )
      expect(updateResult).to.throw(
        "the inbound URI must be a valid FQDN (e.g. sip.example.com)"
      )
    })
  })
})

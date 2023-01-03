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
import { APIVersion, Prisma } from "@prisma/client"
import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import { PeerManager } from "../src/mappers/peer"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/pgdata/mappers/peer", () => {
  afterEach(() => sandbox.restore())

  it("takes a dto object and converts it to prisma model", () => {
    // Arrange
    const peer = {
      apiVersion: "v2",
      ref: "peer-01",
      credentialsRef: "credentials-01",
      accessControlListRef: "acl-01",
      name: "Asterisk Media Server",
      username: "asterisk",
      aor: "sip:1001@sip.local",
      contactAddr: "192.168.1.12",
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      extended: {
        test: "test"
      }
    }

    // Act
    const result = new PeerManager(peer).mapToPrisma()

    // Assert
    expect(result).to.deep.equal(peer)
  })

  it("takes a prisma model and converts it to dto object", () => {
    // Arrange
    type PeerWithDomainAndCredentials = Prisma.PeerGetPayload<{
      include: {
        accessControlList: true
        credentials: true
      }
    }>

    const peer: PeerWithDomainAndCredentials = {
      apiVersion: "v2" as APIVersion,
      ref: "peer-01",
      credentialsRef: "credentials-01",
      name: "Asterisk Media Server",
      username: "asterisk",
      aor: "backend:voice",
      contactAddr: "192.168.1.3",
      enabled: true,
      credentials: {
        apiVersion: "v2" as APIVersion,
        name: "test",
        ref: "credentials-01",
        username: "asterisk",
        password: "1234",
        extended: {
          test: "test"
        }
      },
      accessControlListRef: "acl-01",
      accessControlList: {
        apiVersion: "v2" as APIVersion,
        ref: "acl-01",
        name: "test",
        allow: ["0.0.0.1/16"],
        deny: ["0.0.0.1/16"],
        extended: {
          test: "test"
        }
      },
      extended: {
        test: "test"
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Act
    const result = PeerManager.mapToDto(peer)

    // Assert
    expect(result).to.deep.equal(peer)
  })

  describe("throws errors", () => {
    it("when the friendly name is not provided for create or update operations", () => {
      // Arrange
      const peer = {
        apiVersion: "v2",
        ref: "peer-01",
        credentialsRef: "credentials-01",
        accessControlListRef: "acl-01",
        name: "",
        username: "asterisk",
        aor: "sip:1001@sip.local",
        contactAddr: "192.168.1.12",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        extended: {
          test: "test"
        }
      }

      // Act
      const updateResult = () => new PeerManager(peer).validOrThrowUpdate()
      const createResult = () => new PeerManager(peer).validOrThrowCreate()

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
      const peer = {
        apiVersion: "v2",
        ref: "peer-01",
        credentialsRef: "credentials-01",
        accessControlListRef: "acl-01",
        name: "As",
        username: "asterisk",
        aor: "sip:1001@sip.local",
        contactAddr: "192.168.1.12",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        extended: {
          test: "test"
        }
      }

      // Act
      const updateResult = () => new PeerManager(peer).validOrThrowUpdate()
      const createResult = () => new PeerManager(peer).validOrThrowCreate()

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
      const peer = {
        apiVersion: "v2",
        ref: "",
        credentialsRef: "credentials-01",
        accessControlListRef: "acl-01",
        name: "Asterisk Media Server",
        username: "asterisk",
        aor: "sip:1001@sip.local",
        contactAddr: "192.168.1.12",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        extended: {
          test: "test"
        }
      }

      // Act
      const result = () => new PeerManager(peer).validOrThrowUpdate()

      // Assert
      expect(result).to.throw("the reference to the resource is required")
    })

    it("when the request is missing the username", () => {
      // Arrange
      const peer = {
        apiVersion: "v2",
        ref: "peer-01",
        credentialsRef: "credentials-01",
        accessControlListRef: "acl-01",
        name: "Asterisk Media Server",
        username: "",
        aor: "sip:1001@sip.local",
        contactAddr: "192.168.1.12",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        extended: {
          test: "test"
        }
      }

      // Act
      const result = () => new PeerManager(peer).validOrThrowCreate()

      // Assert
      expect(result).to.throw("the username is required")
    })

    it("when the username is not alphanumeric or has spaces", () => {
      // Arrange
      const peer = {
        apiVersion: "v2",
        ref: "peer-01",
        credentialsRef: "credentials-01",
        accessControlListRef: "acl-01",
        name: "Asterisk Media Server",
        username: "asterisk space",
        aor: "sip:1001@sip.local",
        contactAddr: "192.168.1.12",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        extended: {
          test: "test"
        }
      }

      // Act
      const result = () => new PeerManager(peer).validOrThrowCreate()

      // Assert
      expect(result).to.throw(
        "the username must be alphanumeric and without spaces"
      )
    })

    it("when the request is missing the aor", () => {
      // Arrange
      const peer = {
        apiVersion: "v2",
        ref: "peer-01",
        credentialsRef: "credentials-01",
        accessControlListRef: "acl-01",
        name: "Asterisk Media Server",
        username: "asterisk",
        aor: "",
        contactAddr: "192.168.1.12",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        extended: {
          test: "test"
        }
      }

      // Act
      const result = () => new PeerManager(peer).validOrThrowCreate()

      // Assert
      expect(result).to.throw("the address of record (aor) is required")
    })

    it("when the aor doesn't start with backend: or sip:", () => {
      // Arrange
      const peer = {
        apiVersion: "v2",
        ref: "peer-01",
        credentialsRef: "credentials-01",
        accessControlListRef: "acl-01",
        name: "Asterisk Media Server",
        username: "asterisk",
        aor: "backendx:aor-01",
        contactAddr: "192.168.1.12:5060",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        extended: {
          test: "test"
        }
      }

      // Act
      const createResult = () => new PeerManager(peer).validOrThrowCreate()
      const createUpdate = () => new PeerManager(peer).validOrThrowUpdate()

      // Assert
      expect(createResult).to.throw(
        "the aorLink must start with backend: or sip:"
      )
      expect(createUpdate).to.throw(
        "the aorLink must start with backend: or sip:"
      )
    })
  })
})

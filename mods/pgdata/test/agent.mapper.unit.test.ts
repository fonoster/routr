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
import { APIVersion, Privacy as PrismaPrivacy, Prisma } from "@prisma/client"
import { Privacy } from "@routr/common/src/types"
import { AgentManager } from "../src/mappers/agent"
import chai from "chai"
import sinon from "sinon"
import chaiExclude from "chai-exclude"
import sinonChai from "sinon-chai"

const expect = chai.expect
chai.use(sinonChai)
chai.use(chaiExclude)
const sandbox = sinon.createSandbox()

describe("@routr/pgdata/mappers/agent", () => {
  afterEach(() => sandbox.restore())

  it("takes a dto object and converts it to prisma model", () => {
    // Arrange
    const agent = {
      apiVersion: "v2",
      ref: "agent-01",
      name: "Jhon Doe",
      username: "1001",
      privacy: Privacy.PRIVATE,
      enabled: true,
      domainRef: "domain-01",
      credentialsRef: "credentials-01",
      extended: {
        test: "test"
      },
      maxContacts: 1,
      expires: 3600,
      createdAt: new Date().getTime() / 1000,
      updatedAt: new Date().getTime() / 1000
    }

    // Act
    const result = new AgentManager(agent).mapToPrisma()

    // Assert
    expect(result).excluding(["createdAt", "updatedAt"]).to.deep.equal(agent)
  })

  it("takes a prisma model and converts it to dto object", () => {
    // Arrange
    type AgentWithDomainAndCredentials = Prisma.AgentGetPayload<{
      include: {
        domain: {
          include: {
            accessControlList: true
            egressPolicies: true
          }
        }
        credentials: true
      }
    }>

    const agent: AgentWithDomainAndCredentials = {
      apiVersion: "v2" as APIVersion,
      ref: "agent-01",
      name: "Jhon Doe",
      username: "1001",
      privacy: PrismaPrivacy.PRIVATE,
      enabled: true,
      domainRef: "domain-01",
      credentialsRef: "credentials-01",
      extended: {
        test: "test"
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      maxContacts: 1,
      expires: 3600,
      domain: {
        apiVersion: "v2" as APIVersion,
        ref: "domain-01",
        name: "test",
        domainUri: "test",
        accessControlListRef: "acl-01",
        accessControlList: {
          apiVersion: "v2" as APIVersion,
          ref: "acl-01",
          name: "test",
          allow: ["0.0.0.0/1"],
          deny: ["0.0.0.0/1"],
          createdAt: new Date(),
          updatedAt: new Date(),
          extended: {
            test: "test"
          }
        },
        egressPolicies: [],
        extended: {
          test: "test"
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      credentials: {
        apiVersion: "v2" as APIVersion,
        ref: "credentials-01",
        name: "test",
        username: "1001",
        password: "test",
        createdAt: new Date(),
        updatedAt: new Date(),
        extended: {
          test: "test"
        }
      }
    }

    // Act
    const result = AgentManager.mapToDto(agent)

    // Assert
    expect(result)
      .excludingEvery(["createdAt", "updatedAt"])
      .to.deep.equal(agent)
  })

  describe("throws errors", () => {
    it("when the friendly name is not provided for agent creation", () => {
      // Arrange
      const agent = {
        apiVersion: "v2",
        ref: "agent-01",
        name: "",
        username: "1001",
        privacy: Privacy.PRIVATE,
        enabled: true,
        domainRef: "domain-01",
        credentialsRef: "credentials-01",
        maxContacts: -1,
        extended: {
          test: "test"
        },
        createdAt: new Date().getTime() / 1000,
        updatedAt: new Date().getTime() / 1000
      }

      // Act
      const createResult = () => new AgentManager(agent).validOrThrowCreate()

      // Assert
      expect(createResult).to.throw(
        "the friendly name for the resource is required"
      )
    })

    it("when the friendly name has more than 60 characters", () => {
      // Arrange
      const agent = {
        apiVersion: "v2",
        ref: "agent-01",
        name: "a".repeat(65),
        username: "1001",
        privacy: Privacy.PRIVATE,
        enabled: true,
        domainRef: "domain-01",
        credentialsRef: "credentials-01",
        maxContacts: -1,
        extended: {
          test: "test"
        },
        createdAt: new Date().getTime() / 1000,
        updatedAt: new Date().getTime() / 1000
      }

      // Act
      const updateResult = () => new AgentManager(agent).validOrThrowUpdate()
      const createResult = () => new AgentManager(agent).validOrThrowCreate()

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
      const agent = {
        apiVersion: "v2",
        ref: "",
        name: "Jhon Doe",
        username: "1001",
        privacy: Privacy.PRIVATE,
        enabled: true,
        domainRef: "domain-01",
        credentialsRef: "credentials-01",
        maxContacts: -1,
        extended: {
          test: "test"
        },
        createdAt: new Date().getTime() / 1000,
        updatedAt: new Date().getTime() / 1000
      }

      // Act
      const result = () => new AgentManager(agent).validOrThrowUpdate()

      // Assert
      expect(result).to.throw("the reference to the resource is required")
    })

    it("when username is not present", () => {
      // Arrange
      const agent = {
        apiVersion: "v2",
        ref: "agent-01",
        name: "Jhon Doe",
        username: "",
        privacy: Privacy.PRIVATE,
        enabled: true,
        domainRef: "domain-01",
        credentialsRef: "credentials-01",
        maxContacts: -1,
        extended: {
          test: "test"
        },
        createdAt: new Date().getTime() / 1000,
        updatedAt: new Date().getTime() / 1000
      }

      // Act
      const result = () => new AgentManager(agent).validOrThrowCreate()

      // Assert
      expect(result).to.throw("the username is required")
    })

    it("when username is not alphanumeric without spaces", () => {
      // Arrange
      const agent = {
        apiVersion: "v2",
        ref: "agent-01",
        name: "Jhon Doe",
        username: "1 0 0 1",
        privacy: Privacy.PRIVATE,
        enabled: true,
        domainRef: "domain-01",
        credentialsRef: "credentials-01",
        maxContacts: -1,
        extended: {
          test: "test"
        },
        createdAt: new Date().getTime() / 1000,
        updatedAt: new Date().getTime() / 1000
      }

      // Act
      const result = () => new AgentManager(agent).validOrThrowCreate()

      // Assert
      expect(result).to.throw("the username must not contain spaces")
    })
  })
})

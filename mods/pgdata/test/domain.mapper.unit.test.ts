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
import { APIVersion, Prisma } from "@prisma/client"
import { DomainManager } from "../src/mappers/domain"
import chai from "chai"
import sinon from "sinon"
import chaiExclude from "chai-exclude"
import sinonChai from "sinon-chai"

const expect = chai.expect
chai.use(sinonChai)
chai.use(chaiExclude)
const sandbox = sinon.createSandbox()

describe("@routr/pgdata/mappers/domain", () => {
  afterEach(() => sandbox.restore())

  it("takes a dto object and converts it to prisma model", () => {
    // Arrange
    const domain = {
      apiVersion: "v2",
      ref: "domain-01",
      name: "Local Domain",
      accessControlListRef: "acl-01",
      domainUri: "sip.local",
      extended: {
        test: "test"
      },
      createdAt: new Date().getTime() / 1000,
      updatedAt: new Date().getTime() / 1000
    }

    // Act
    const result = new DomainManager(domain).mapToPrisma()

    // Assert
    expect(result)
      .excluding(["createdAt", "updatedAt", "egressPolicies"])
      .to.deep.equal(domain)
  })

  it("takes a prisma model and converts it to dto object", () => {
    // Arrange
    type DomainWithACL = Prisma.DomainGetPayload<{
      include: {
        accessControlList: true
        egressPolicies: true
      }
    }>

    const domain: DomainWithACL = {
      apiVersion: "v2" as APIVersion,
      ref: "domain-01",
      name: "Local Domain",
      accessControlListRef: "acl-01",
      domainUri: "sip.local",
      createdAt: new Date(),
      updatedAt: new Date(),
      extended: {
        test: "test"
      },
      accessControlList: {
        apiVersion: "v2" as APIVersion,
        ref: "acl-01",
        name: "test",
        allow: ["192.168.1.2/31"],
        deny: ["0.0.0.0/1"],
        createdAt: new Date(),
        updatedAt: new Date(),
        extended: {
          test: "test"
        }
      },
      egressPolicies: []
    }

    // Act
    const result = DomainManager.mapToDto(domain)

    // Assert
    expect(result)
      .excludingEvery(["createdAt", "updatedAt"])
      .to.deep.equal(domain)
  })

  describe("throws errors", () => {
    it("when the friendly name is not provided for domain creation", () => {
      // Arrange
      const domain = {
        apiVersion: "v2",
        ref: "domain-01",
        name: "",
        accessControlListRef: "acl-01",
        domainUri: "sip.local",
        extended: {
          test: "test"
        },
        createdAt: new Date().getTime() / 1000,
        updatedAt: new Date().getTime() / 1000
      }

      // Act
      const createResult = () => new DomainManager(domain).validOrThrowCreate()

      // Assert
      expect(createResult).to.throw(
        "the friendly name for the resource is required"
      )
    })

    it("when the friendly name has more than 60 characters", () => {
      // Arrange
      const domain = {
        apiVersion: "v2",
        ref: "domain-01",
        name: "a".repeat(65),
        accessControlListRef: "acl-01",
        domainUri: "sip.local",
        extended: {
          test: "test"
        },
        createdAt: new Date().getTime() / 1000,
        updatedAt: new Date().getTime() / 1000
      }

      // Act
      const updateResult = () => new DomainManager(domain).validOrThrowUpdate()
      const createResult = () => new DomainManager(domain).validOrThrowCreate()

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
      const domain = {
        apiVersion: "v2",
        ref: "",
        name: "Local Domain",
        accessControlListRef: "acl-01",
        domainUri: "sip.local",
        extended: {
          test: "test"
        },
        createdAt: new Date().getTime() / 1000,
        updatedAt: new Date().getTime() / 1000
      }

      // Act
      const result = () => new DomainManager(domain).validOrThrowUpdate()

      // Assert
      expect(result).to.throw("the reference to the resource is required")
    })

    it("when domainUri is not a valid FQDN", () => {
      // Arrange
      const domain = {
        apiVersion: "v2",
        ref: "domain-01",
        name: "Local Domain",
        accessControlListRef: "acl-01",
        domainUri: "sip-local",
        extended: {
          test: "test"
        },
        createdAt: new Date().getTime() / 1000,
        updatedAt: new Date().getTime() / 1000
      }

      // Act
      const result = () => new DomainManager(domain).validOrThrowCreate()

      // Assert
      expect(result).to.throw(
        "the domainUri must be a valid fully qualified domain name"
      )
    })
  })
})

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
import { APIVersion } from "@prisma/client"
import { ACLManager } from "../src/mappers/acl"
import chai from "chai"
import sinon from "sinon"
import chaiExclude from "chai-exclude"
import sinonChai from "sinon-chai"

const expect = chai.expect
chai.use(sinonChai)
chai.use(chaiExclude)
const sandbox = sinon.createSandbox()

describe("@routr/pgdata/mappers/acl", () => {
  afterEach(() => sandbox.restore())

  it("takes a dto object and converts it to prisma model", () => {
    // Arrange
    const acl = {
      apiVersion: "v2",
      ref: "acl-01",
      name: "Local Network ACL",
      allow: ["192.168.1.3/31"],
      deny: ["0.0.0.0/1"],
      createdAt: new Date().getTime() / 1000,
      updatedAt: new Date().getTime() / 1000,
      extended: {
        test: "test"
      }
    }

    // Act
    const result = new ACLManager(acl).mapToPrisma()

    // Assert
    expect(result).excluding(["createdAt", "updatedAt"]).to.deep.equal(acl)
  })

  it("takes a prisma model and converts it to dto object", () => {
    // Arrange
    const acl = {
      apiVersion: "v2" as APIVersion,
      ref: "acl-01",
      name: "Local Network ACL",
      allow: ["192.168.1.3/31"],
      deny: ["0.0.0.0/1"],
      createdAt: new Date(),
      updatedAt: new Date(),
      extended: {
        test: "test"
      }
    }

    // Act
    const result = ACLManager.mapToDto(acl)

    // Assert
    expect(result).excluding(["createdAt", "updatedAt"]).to.deep.equal(acl)
  })

  describe("throws errors", () => {
    it("when the friendly name is not provided for create operations", () => {
      // Arrange
      const acl = {
        apiVersion: "v2",
        ref: "acl-01",
        name: "",
        allow: ["192.168.1.3/31"],
        deny: ["0.0.0.0/1"],
        extended: {
          test: "test"
        }
      }

      // Act
      const createResult = () => new ACLManager(acl).validOrThrowCreate()

      // Assert
      expect(createResult).to.throw(
        "the friendly name for the resource is required"
      )
    })

    it("when the friendly name has more than 60 characters", () => {
      // Arrange
      const acl = {
        apiVersion: "v2",
        ref: "acl-01",
        name: "a".repeat(65),
        allow: ["192.168.1.3/31"],
        deny: ["0.0.0.0/1"],
        extended: {
          test: "test"
        }
      }

      // Act
      const updateResult = () => new ACLManager(acl).validOrThrowUpdate()
      const createResult = () => new ACLManager(acl).validOrThrowCreate()

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
      const acl = {
        apiVersion: "v2",
        ref: "",
        name: "Local Network ACL",
        allow: ["192.168.1.3/31"],
        deny: ["0.0.0.0/1"],
        extended: {
          test: "test"
        }
      }

      // Act
      const result = () => new ACLManager(acl).validOrThrowUpdate()

      // Assert
      expect(result).to.throw("the reference to the resource is required")
    })

    it("when it finds an invalid allow or deny rule", () => {
      // Arrange
      const acl = {
        apiVersion: "v2",
        ref: "acl-01",
        name: "Local Network ACL",
        allow: ["19x.168.1.3/31"],
        deny: ["0.0.0.0/1"],
        extended: {
          test: "test"
        }
      }

      // Act
      const createResult = () => new ACLManager(acl).validOrThrowCreate()
      const updateResult = () => new ACLManager(acl).validOrThrowUpdate()

      // Assert
      expect(createResult).to.throw("19x.168.1.3/31 is not a valid cidr")
      expect(updateResult).to.throw("19x.168.1.3/31 is not a valid cidr")
    })

    it("when missing deny or allow values", () => {
      // Arrange
      const acl = {
        apiVersion: "v2",
        ref: "acl-01",
        name: "test",
        allow: [] as string[],
        deny: ["0.0.0.0/1"],
        extended: {
          test: "test"
        }
      }

      // Act
      const createResult = () => new ACLManager(acl).validOrThrowCreate()

      // Assert
      expect(createResult).to.throw("acl rules are required")
    })
  })
})

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
import { CredentialsManager } from "../src/mappers/credentials"
import chai from "chai"
import sinon from "sinon"
import chaiExclude from "chai-exclude"
import sinonChai from "sinon-chai"

const expect = chai.expect
chai.use(sinonChai)
chai.use(chaiExclude)
const sandbox = sinon.createSandbox()

describe("@routr/pgdata/mappers/credentials", () => {
  afterEach(() => sandbox.restore())

  it("takes a dto object and converts it to prisma model", () => {
    // Arrange
    const credentials = {
      apiVersion: "v2",
      ref: "credentials-01",
      name: "Global Credentials",
      username: "1001",
      password: "1234",
      createdAt: new Date().getTime() / 1000,
      updatedAt: new Date().getTime() / 1000,
      extended: {
        test: "test"
      }
    }

    // Act
    const result = new CredentialsManager(credentials).mapToPrisma()

    // Assert
    expect(result)
      .excluding(["createdAt", "updatedAt"])
      .to.deep.equal(credentials)
  })

  it("takes a prisma model and converts it to dto object", () => {
    // Arrange
    const credentials = {
      apiVersion: "v2" as APIVersion,
      ref: "credentials-01",
      name: "Global Credentials",
      username: "1001",
      password: "1234",
      createdAt: new Date(),
      updatedAt: new Date(),
      extended: {
        test: "test"
      }
    }

    // Act
    const result = CredentialsManager.mapToDto(credentials)

    // Assert
    expect(result)
      .excluding(["createdAt", "updatedAt"])
      .to.deep.equal(credentials)
  })

  describe("throws errors", () => {
    it("when the friendly name is not provided for create or update operations", () => {
      // Arrange
      const credentials = {
        apiVersion: "v2" as APIVersion,
        ref: "credentials-01",
        name: "",
        username: "1001",
        password: "1234",
        extended: {
          test: "test"
        }
      }

      // Act
      const updateResult = () =>
        new CredentialsManager(credentials).validOrThrowUpdate()
      const createResult = () =>
        new CredentialsManager(credentials).validOrThrowCreate()

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
      const credentials = {
        apiVersion: "v2" as APIVersion,
        ref: "credentials-01",
        name: "Gl",
        username: "1001",
        password: "1234",
        extended: {
          test: "test"
        }
      }

      // Act
      const updateResult = () =>
        new CredentialsManager(credentials).validOrThrowUpdate()
      const createResult = () =>
        new CredentialsManager(credentials).validOrThrowCreate()

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
      const credentials = {
        apiVersion: "v2" as APIVersion,
        ref: "",
        name: "Global Credentials",
        username: "1001",
        password: "1234",
        extended: {
          test: "test"
        }
      }

      // Act
      const result = () =>
        new CredentialsManager(credentials).validOrThrowUpdate()

      // Assert
      expect(result).to.throw("the reference to the resource is required")
    })

    it("when request is missing the username", () => {
      // Arrange
      const credentials = {
        apiVersion: "v2" as APIVersion,
        ref: "credentials-01",
        name: "Global Credentials",
        username: "",
        password: "1234",
        extended: {
          test: "test"
        }
      }

      // Act
      const result = () =>
        new CredentialsManager(credentials).validOrThrowCreate()

      // Assert
      expect(result).to.throw("he username is required")
    })

    it("when the username is non-alphanumeric or has spaces", () => {
      // Arrange
      const credentials = {
        apiVersion: "v2" as APIVersion,
        ref: "credentials-01",
        name: "Global Credentials",
        username: "1001 #",
        password: "1234",
        extended: {
          test: "test"
        }
      }

      // Act
      const createResult = () =>
        new CredentialsManager(credentials).validOrThrowCreate()
      const updateResult = () =>
        new CredentialsManager(credentials).validOrThrowUpdate()

      // Assert
      expect(createResult).to.throw(
        "the username must be alphanumeric and without space"
      )
      expect(updateResult).to.throw(
        "the username must be alphanumeric and without space"
      )
    })

    it("when request is missing the password", () => {
      // Arrange
      const credentials = {
        apiVersion: "v2" as APIVersion,
        ref: "credentials-01",
        name: "Global Credentials",
        username: "1234",
        password: "",
        extended: {
          test: "test"
        }
      }

      // Act
      const createResult = () =>
        new CredentialsManager(credentials).validOrThrowCreate()

      // Assert
      expect(createResult).to.throw("he password is required")
    })
  })
})

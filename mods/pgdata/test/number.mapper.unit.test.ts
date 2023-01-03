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
import { APIVersion, Prisma, Transport } from "@prisma/client"
import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import { NumberManager } from "../src/mappers/number"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/pgdata/mappers/number", () => {
  afterEach(() => sandbox.restore())

  it("takes a dto object and converts it to prisma model", () => {
    // Arrange
    const number = {
      apiVersion: "v2",
      ref: "number-01",
      trunkRef: "trunk-01",
      name: "(785)317-8070",
      telUrl: "tel:+17853178070",
      aorLink: "backend:aor-01",
      city: "Durham",
      country: "United States",
      countryISOCode: "US",
      sessionAffinityHeader: "x-session-affinity",
      extraHeaders: [
        {
          name: "x-test",
          value: "test"
        }
      ],
      extended: {
        test: "test"
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Act
    const result = new NumberManager(number).mapToPrisma()

    // Assert
    expect(result).to.deep.equal(number)
  })

  it("takes a prisma model and converts it to dto object", () => {
    // Arrange
    type NumberWithTrunk = Prisma.NumberGetPayload<{
      include: {
        trunk: {
          include: {
            accessControlList: true
            inboundCredentials: true
            outboundCredentials: true
            uris: true
          }
        }
      }
    }>

    const number: NumberWithTrunk = {
      apiVersion: "v2" as APIVersion,
      ref: "number-01",
      trunkRef: "trunk-01",
      name: "(785)317-8070",
      telUrl: "tel:+17853178070",
      aorLink: "aor-01",
      city: "Durham",
      country: "United States",
      countryISOCode: "US",
      sessionAffinityHeader: "x-session-affinity",
      extraHeaders: [{ name: "x-test", value: "test" }],
      extended: {
        test: "test"
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      trunk: {
        apiVersion: "v2" as APIVersion,
        ref: "trunk-01",
        name: "Global Trunk",
        accessControlListRef: "acl-01",
        sendRegister: true,
        inboundUri: "sip:sip.local",
        inboundCredentialsRef: "inbound-01",
        inboundCredentials: {
          apiVersion: "v2" as APIVersion,
          ref: "inbound-01",
          name: "test",
          username: "test",
          password: "test",
          extended: {
            test: "test"
          }
        },
        outboundCredentialsRef: "outbound-01",
        outboundCredentials: {
          apiVersion: "v2" as APIVersion,
          ref: "outbound-01",
          name: "test",
          username: "test",
          password: "test",
          extended: {
            test: "test"
          }
        },
        accessControlList: {
          apiVersion: "v2" as APIVersion,
          ref: "acl-01",
          name: "test",
          allow: ["0.0.0.1/1"],
          deny: ["0.0.0.0./1"],
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
            transport: Transport.UDP,
            user: "test",
            weight: 1,
            priority: 1,
            enabled: true
          }
        ],
        extended: {
          test: "test"
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }

    // Act
    const result = NumberManager.mapToDto(number)

    // Assert
    expect(result).to.deep.equal(number)
  })

  describe("throws errors", () => {
    it("when the friendly name is not provided for create or update operations", () => {
      // Arrange
      const number = {
        apiVersion: "v2",
        ref: "number-01",
        trunkRef: "trunk-01",
        name: "",
        telUrl: "tel:+17853178070",
        aorLink: "backend:aor-01",
        city: "Durham",
        country: "United States",
        countryISOCode: "US",
        sessionAffinityHeader: "x-session-affinity",
        extraHeaders: [
          {
            name: "x-test",
            value: "test"
          }
        ],
        extended: {
          test: "test"
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Act
      const updateResult = () => new NumberManager(number).validOrThrowUpdate()
      const createResult = () => new NumberManager(number).validOrThrowCreate()

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
      const number = {
        apiVersion: "v2",
        ref: "number-01",
        trunkRef: "trunk-01",
        name: "(7",
        telUrl: "tel:+17853178070",
        aorLink: "backend:aor-01",
        city: "Durham",
        country: "United States",
        countryISOCode: "US",
        sessionAffinityHeader: "x-session-affinity",
        extraHeaders: [
          {
            name: "x-test",
            value: "test"
          }
        ],
        extended: {
          test: "test"
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Act
      const updateResult = () => new NumberManager(number).validOrThrowUpdate()
      const createResult = () => new NumberManager(number).validOrThrowCreate()

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
      const number = {
        apiVersion: "v2",
        ref: "",
        trunkRef: "trunk-01",
        name: "(785)317-8070",
        telUrl: "tel:+17853178070",
        aorLink: "backend:aor-01",
        city: "Durham",
        country: "United States",
        countryISOCode: "US",
        sessionAffinityHeader: "x-session-affinity",
        extraHeaders: [
          {
            name: "x-test",
            value: "test"
          }
        ],
        extended: {
          test: "test"
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Act
      const result = () => new NumberManager(number).validOrThrowUpdate()

      // Assert
      expect(result).to.throw("the reference to the resource is required")
    })

    it("when the request is missing the telUrl", () => {
      // Arrange
      const number = {
        apiVersion: "v2",
        ref: "number-01",
        trunkRef: "trunk-01",
        name: "(785)317-8070",
        telUrl: "",
        aorLink: "backend:aor-01",
        city: "Durham",
        country: "United States",
        countryISOCode: "US",
        sessionAffinityHeader: "x-session-affinity",
        extraHeaders: [
          {
            name: "x-test",
            value: "test"
          }
        ],
        extended: {
          test: "test"
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
      // Act
      const result = () => new NumberManager(number).validOrThrowCreate()

      // Assert
      expect(result).to.throw("the telUrl is required")
    })

    it("when sessionAffinityHeader is not alphanumeric or has spaces", () => {
      // Arrange
      const number = {
        apiVersion: "v2",
        ref: "number-01",
        trunkRef: "trunk-01",
        name: "(785)317-8070",
        telUrl: "tel:+17853178070",
        aorLink: "aor-01",
        city: "Durham",
        country: "United States",
        countryISOCode: "US",
        sessionAffinityHeader: "x-session-affinity space",
        extraHeaders: [
          {
            name: "x-test",
            value: "test"
          }
        ],
        extended: {
          test: "test"
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
      // Act
      const createResult = () => new NumberManager(number).validOrThrowCreate()
      const updateResult = () => new NumberManager(number).validOrThrowUpdate()

      // Assert
      expect(createResult).to.throw(
        "the sessionAffinityHeader must be alphanumeric and without spaces"
      )
      expect(updateResult).to.throw(
        "the sessionAffinityHeader must be alphanumeric and without spaces"
      )
    })

    it("when aor link doesn't start with backend: or sip:", () => {
      // Arrange
      const number = {
        apiVersion: "v2",
        ref: "number-01",
        trunkRef: "trunk-01",
        name: "(785)317-8070",
        telUrl: "tel:+17853178070",
        aorLink: "backenx:aor-01",
        city: "Durham",
        country: "United States",
        countryISOCode: "US",
        sessionAffinityHeader: "x-session-affinity",
        extraHeaders: [
          {
            name: "x-test",
            value: "test"
          }
        ],
        extended: {
          test: "test"
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
      // Act
      const createResult = () => new NumberManager(number).validOrThrowCreate()
      const updateResult = () => new NumberManager(number).validOrThrowUpdate()

      // Assert
      expect(createResult).to.throw(
        "the sessionAffinityHeader must be alphanumeric and without spaces"
      )
      expect(updateResult).to.throw(
        "the sessionAffinityHeader must be alphanumeric and without spaces"
      )
    })
  })
})

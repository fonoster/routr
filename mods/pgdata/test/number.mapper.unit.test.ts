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
import { Prisma, Transport } from "@prisma/client"
import { CommonConnect as CC } from "@routr/common"
import { NumberManager } from "../src/mappers/number"
import chai from "chai"
import sinon from "sinon"
import chaiExclude from "chai-exclude"
import sinonChai from "sinon-chai"

const expect = chai.expect
chai.use(sinonChai)
chai.use(chaiExclude)
const sandbox = sinon.createSandbox()

describe("@routr/pgdata/mappers/number", () => {
  afterEach(() => sandbox.restore())

  it("takes a dto object and converts it to prisma model", () => {
    // Arrange
    const number = {
      apiVersion: CC.APIVersion.V2,
      ref: "number-01",
      trunkRef: "trunk-01",
      name: "(785)317-8070",
      telUrl: "tel:+17853178070",
      aorLink: "sip:aor-01@sip.local",
      city: "Durham",
      country: "United States",
      countryIsoCode: "US",
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
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime()
    }

    // Act
    const result = new NumberManager(number).mapToPrisma()

    // Assert
    expect(result)
      .excluding(["createdAt", "updatedAt", "countryIsoCode", "countryIsoCode"])
      .to.deep.equal(number)
    expect(result).to.have.property("countryIsoCode", number.countryIsoCode)
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
      apiVersion: CC.APIVersion.V2,
      ref: "number-01",
      trunkRef: "trunk-01",
      name: "(785)317-8070",
      telUrl: "tel:+17853178070",
      aorLink: "aor-01",
      city: "Durham",
      country: "United States",
      countryIsoCode: "US",
      sessionAffinityHeader: "x-session-affinity",
      extraHeaders: [{ name: "x-test", value: "test" }],
      extended: {
        test: "test"
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      trunk: {
        apiVersion: CC.APIVersion.V2,
        ref: "trunk-01",
        name: "Global Trunk",
        accessControlListRef: "acl-01",
        sendRegister: true,
        inboundUri: "sip:sip.local",
        inboundCredentialsRef: "inbound-01",
        inboundCredentials: {
          apiVersion: CC.APIVersion.V2,
          ref: "inbound-01",
          name: "test",
          username: "test",
          password: "test",
          createdAt: new Date(),
          updatedAt: new Date(),
          extended: {
            test: "test"
          }
        },
        outboundCredentialsRef: "outbound-01",
        outboundCredentials: {
          apiVersion: CC.APIVersion.V2,
          ref: "outbound-01",
          name: "test",
          username: "test",
          password: "test",
          createdAt: new Date(),
          updatedAt: new Date(),
          extended: {
            test: "test"
          }
        },
        accessControlList: {
          apiVersion: CC.APIVersion.V2,
          ref: "acl-01",
          name: "test",
          allow: ["0.0.0.1/1"],
          deny: ["0.0.0.0./1"],
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
    expect(result)
      .excludingEvery(["createdAt", "updatedAt", "countryIsoCode"])
      .to.deep.equal(number)
    expect(result).to.have.property("countryIsoCode", number.countryIsoCode)
  })

  describe("throws errors", () => {
    it("when the friendly name is not provided for create operations", () => {
      // Arrange
      const number = {
        apiVersion: CC.APIVersion.V2,
        ref: "number-01",
        trunkRef: "trunk-01",
        name: "",
        telUrl: "tel:+17853178070",
        aorLink: "sip:aor-01@sip.local",
        city: "Durham",
        country: "United States",
        countryIsoCode: "US",
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
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime()
      }

      // Act
      const createResult = () => new NumberManager(number).validOrThrowCreate()

      // Assert
      expect(createResult).to.throw(
        "the friendly name for the resource is required"
      )
    })

    it("when the friendly name has more than 60 characters", () => {
      // Arrange
      const number = {
        apiVersion: CC.APIVersion.V2,
        ref: "number-01",
        trunkRef: "trunk-01",
        name: "a".repeat(65),
        telUrl: "tel:+17853178070",
        aorLink: "sip:aor-01@sip.local",
        city: "Durham",
        country: "United States",
        countryIsoCode: "US",
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
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime()
      }

      // Act
      const updateResult = () => new NumberManager(number).validOrThrowUpdate()
      const createResult = () => new NumberManager(number).validOrThrowCreate()

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
      const number = {
        apiVersion: CC.APIVersion.V2,
        ref: "",
        trunkRef: "trunk-01",
        name: "(785)317-8070",
        telUrl: "tel:+17853178070",
        aorLink: "sip:aor-01@sip.local",
        city: "Durham",
        country: "United States",
        countryIsoCode: "US",
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
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime()
      }

      // Act
      const result = () => new NumberManager(number).validOrThrowUpdate()

      // Assert
      expect(result).to.throw("the reference to the resource is required")
    })

    it("when the request is missing the telUrl", () => {
      // Arrange
      const number = {
        apiVersion: CC.APIVersion.V2,
        ref: "number-01",
        trunkRef: "trunk-01",
        name: "(785)317-8070",
        telUrl: "",
        aorLink: "sip:aor-01@sip.local",
        city: "Durham",
        country: "United States",
        countryIsoCode: "US",
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
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime()
      }
      // Act
      const result = () => new NumberManager(number).validOrThrowCreate()

      // Assert
      expect(result).to.throw("the telUrl is required")
    })

    it("when sessionAffinityHeader is not alphanumeric or has spaces", () => {
      // Arrange
      const number = {
        apiVersion: CC.APIVersion.V2,
        ref: "number-01",
        trunkRef: "trunk-01",
        name: "(785)317-8070",
        telUrl: "tel:+17853178070",
        aorLink: "sip:aor-01@sip.local",
        city: "Durham",
        country: "United States",
        countryIsoCode: "US",
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
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime()
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
        apiVersion: CC.APIVersion.V2,
        ref: "number-01",
        trunkRef: "trunk-01",
        name: "(785)317-8070",
        telUrl: "tel:+17853178070",
        aorLink: "backenx:aor-01",
        city: "Durham",
        country: "United States",
        countryIsoCode: "US",
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
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime()
      }
      // Act
      const createResult = () => new NumberManager(number).validOrThrowCreate()
      const updateResult = () => new NumberManager(number).validOrThrowUpdate()

      // Assert
      expect(createResult).to.throw(
        "the aorLink must start with backend: or sip"
      )
      expect(updateResult).to.throw(
        "the aorLink must start with backend: or sip"
      )
    })
  })
})

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
import { Prisma, Transport } from "@prisma/client"
import { CommonConnect as CC } from "@routr/common"
import { NumberManager } from "../src/mappers/number"
import chai from "chai"

const expect = chai.expect

describe("@routr/pgdata/mappers/number nested under a Domain", () => {
  const createdAt = new Date(1700000000000)
  const trunk: Prisma.TrunkGetPayload<{
    include: {
      accessControlList: true
      inboundCredentials: true
      outboundCredentials: true
      uris: true
    }
  }> = {
    apiVersion: CC.APIVersion.V2,
    ref: "trunk-01",
    name: "Trunk",
    sendRegister: false,
    normalizeToE164: false,
    rewriteFromWithNumber: false,
    fromDomain: null,
    inboundUri: "trunk01.acme.com",
    accessControlListRef: null,
    inboundCredentialsRef: null,
    outboundCredentialsRef: null,
    accessControlList: null,
    inboundCredentials: null,
    outboundCredentials: null,
    uris: [
      {
        ref: "uri-01",
        trunkRef: "trunk-01",
        host: "sip.provider.net",
        port: 5060,
        transport: Transport.UDP,
        user: null,
        weight: null,
        priority: null,
        enabled: true
      }
    ],
    createdAt,
    updatedAt: createdAt,
    extended: null,
    traceEnabled: false
  }
  const number: Prisma.NumberGetPayload<Record<string, never>> = {
    apiVersion: CC.APIVersion.V2,
    ref: "number-01",
    trunkRef: "trunk-01",
    telUrl: "tel:+17853178070",
    aliases: [],
    name: "Main",
    aorLink: "sip:1001@sip.local",
    city: "Columbus",
    country: "USA",
    countryIsoCode: "US",
    sessionAffinityHeader: null,
    extraHeaders: null,
    createdAt,
    updatedAt: createdAt,
    extended: null
  }

  it("maps the Trunk when it was included", () => {
    // Act
    const nested = NumberManager.mapToDtoNested({ ...number, trunk })

    // Assert: a Date used to leak through as the Trunk's timestamps
    expect(nested.trunk.createdAt).to.equal(1700000000)
    expect(nested.trunk.updatedAt).to.equal(1700000000)
    expect(nested.trunk.trace).to.deep.equal({ enabled: false })
    expect(nested.trunk.uris[0].transport).to.equal("UDP")
  })

  it("carries no trunk when it wasn't included", () => {
    expect(NumberManager.mapToDtoNested(number)).to.not.have.property("trunk")
  })
})

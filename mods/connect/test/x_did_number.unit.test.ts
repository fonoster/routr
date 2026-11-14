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
import chai from "chai"
import sinon from "sinon"
import {
  CommonConnect as CC,
  CommonTypes as CT,
  MessageRequest
} from "@routr/common"
import { Extensions as E, Response } from "@routr/processor"
import { ILocationService } from "@routr/location"
import { handleRequest } from "../src/handlers/request"
import { UNTRUSTED_HEADERS_TO_STRIP } from "../src/envs"
import { apiClient } from "./mock_apis"
import { createRequest, r1 } from "./examples"

const expect = chai.expect
const sandbox = sinon.createSandbox()

const CARRIER_ADDRESS = "192.0.2.10"

const trunkUK = {
  apiVersion: CC.APIVersion.V2,
  ref: "trunk-uk",
  name: "Carrier UK",
  inboundUri: "carrier-uk.pstn.example",
  sendRegister: false,
  accessControlList: {
    ref: "acl-carrier",
    name: "Carrier",
    allow: [`${CARRIER_ADDRESS}/32`],
    deny: ["0.0.0.0/0"]
  }
} as CC.Trunk

const numberUK = (extraHeaders: { name: string; value: string }[] = []) =>
  ({
    apiVersion: CC.APIVersion.V2,
    ref: "number-uk",
    name: "London",
    telUrl: "tel:+442079460018",
    aorLink: "sip:1001@sip.local",
    city: "London",
    country: "United Kingdom",
    countryIsoCode: "GB",
    aliases: ["sales"],
    extraHeaders,
    trunkRef: trunkUK.ref,
    trunk: trunkUK,
    createdAt: 1700000000,
    updatedAt: 1700000000
  } as CC.INumber)

const apiWith = (number: CC.INumber): CC.APIClient => ({
  ...apiClient,
  trunks: {
    ...apiClient.trunks,
    findBy: async (request: CC.FindByRequest) => ({
      items: request.fieldValue === trunkUK.inboundUri ? [trunkUK] : []
    })
  },
  numbers: {
    ...apiClient.numbers,
    findBy: async (request: CC.FindByRequest) => ({
      items:
        number[request.fieldName as keyof CC.INumber] === request.fieldValue
          ? [number]
          : []
    })
  }
})

const inviteTo = (user: string, carrierCopy?: string) => {
  const req = createRequest({
    fromUser: "447700900123",
    fromDomain: "sip.carrier.example",
    toUser: user,
    toDomain: trunkUK.inboundUri,
    requestUriHost: trunkUK.inboundUri
  })
  req.message.via[0] = { ...req.message.via[0], received: CARRIER_ADDRESS }
  req.message.authorization = undefined
  if (carrierCopy) {
    req.message.extensions.push({ name: "X-DID-Number", value: carrierCopy })
  }
  return req
}

const locationFor = (req: MessageRequest) =>
  ({
    findRoutes: async () => [
      {
        ...r1,
        listeningPoints: req.listeningPoints,
        localnets: req.localnets,
        externalAddrs: req.externalAddrs,
        headers: [] as CT.HeaderModifier[]
      }
    ]
  } as unknown as ILocationService)

const forward = async (req: MessageRequest, number = numberUK()) => {
  let sent: MessageRequest
  const response = {
    send: (message: MessageRequest) => (sent = message)
  } as unknown as Response

  await handleRequest(locationFor(req), apiWith(number))(req, response)

  return sent
}

const didNumbersOf = (sent: MessageRequest) =>
  sent.message.extensions.filter(
    (h: CT.Extension) => h.name.toLowerCase() === "x-did-number"
  )

describe("@routr/connect X-DID-Number", () => {
  afterEach(() => sandbox.restore())

  it("names the Number on every routed call, however it matched", async () => {
    const users = ["+442079460018", "442079460018", "02079460018", "sales"]

    const sent = await Promise.all(users.map((user) => forward(inviteTo(user))))

    sent.forEach((message) => {
      expect(didNumbersOf(message)).to.deep.equal([
        { name: "X-DID-Number", value: "+442079460018" }
      ])
      expect(E.getHeaderValue(message, "X-DID-Number")).to.equal(
        "+442079460018"
      )
    })
  })

  it("replaces the copy the carrier sent", async () => {
    const sent = await forward(inviteTo("02079460018", "+15550000000"))

    expect(didNumbersOf(sent)).to.deep.equal([
      { name: "X-DID-Number", value: "+442079460018" }
    ])
  })

  it("replaces the carrier's copy with an empty UNTRUSTED_HEADERS_TO_STRIP", async () => {
    const saved = UNTRUSTED_HEADERS_TO_STRIP.splice(0)

    try {
      const sent = await forward(inviteTo("02079460018", "+15550000000"))

      expect(didNumbersOf(sent)).to.deep.equal([
        { name: "X-DID-Number", value: "+442079460018" }
      ])
    } finally {
      UNTRUSTED_HEADERS_TO_STRIP.push(...saved)
    }
  })

  it("wins over an extra header of the Number with the same name", async () => {
    const sent = await forward(
      inviteTo("02079460018"),
      numberUK([
        { name: "x-did-number", value: "x" },
        { name: "X-Tenant", value: "acme" }
      ])
    )

    expect(didNumbersOf(sent)).to.deep.equal([
      { name: "X-DID-Number", value: "+442079460018" }
    ])
    expect(E.getHeaderValue(sent, "X-Tenant")).to.equal("acme")
  })

  it("forwards To and From as received", async () => {
    const sent = await forward(inviteTo("02079460018"))

    expect(sent.message.to.address.uri.user).to.equal("02079460018")
    expect(sent.message.from.address.uri.user).to.equal("447700900123")
  })

  it("is not added to a call that gets no route", async () => {
    const sent = await forward(inviteTo("99999"))

    expect(sent.message).to.have.property(
      "responseType",
      CT.ResponseType.NOT_FOUND
    )
  })
})

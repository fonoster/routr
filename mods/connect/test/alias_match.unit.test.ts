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
import sinonChai from "sinon-chai"
import {
  CommonConnect as CC,
  CommonTypes as CT,
  MessageRequest
} from "@routr/common"
import { Response } from "@routr/processor"
import { ILocationService } from "@routr/location"
import { router } from "../src/router"
import { handleRequest } from "../src/handlers/request"
import { RoutingDirection } from "../src/types"
import { apiClient } from "./mock_apis"
import { createRequest, r1 } from "./examples"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

const CARRIER_ADDRESS = "192.0.2.10"

const trunkOf = (ref: string, inboundUri: string): CC.Trunk =>
  ({
    apiVersion: CC.APIVersion.V2,
    ref,
    name: ref,
    inboundUri,
    sendRegister: false,
    accessControlList: {
      ref: "acl-carrier",
      name: "Carrier",
      allow: [`${CARRIER_ADDRESS}/32`],
      deny: ["0.0.0.0/0"]
    }
  } as CC.Trunk)

const trunk01 = trunkOf("trunk-01", "carrier-uk.pstn.example")
const trunk02 = trunkOf("trunk-02", "carrier-it.pstn.example")

const numberOf = (
  telUrl: string,
  countryIsoCode: string,
  trunk: CC.Trunk,
  aliases: string[] = []
): CC.INumber => ({
  apiVersion: CC.APIVersion.V2,
  ref: `number-${telUrl.slice(5)}`,
  name: telUrl,
  telUrl,
  aorLink: `sip:${telUrl.slice(6)}@sip.local`,
  city: "Unknown",
  country: "Unknown",
  countryIsoCode,
  aliases,
  trunkRef: trunk.ref,
  trunk,
  createdAt: 1700000000,
  updatedAt: 1700000000
})

const london = numberOf("tel:+442079460018", "GB", trunk01)
const labelled = numberOf("tel:+442079460018", "GB", trunk01, ["01234"])
const leeds = numberOf("tel:+441134960000", "GB", trunk01)

// The Agents, Peers and Domains of config/resources, with these Trunks and
// Numbers
const apiWith = (numbers: CC.INumber[]): CC.APIClient => ({
  ...apiClient,
  trunks: {
    ...apiClient.trunks,
    findBy: async (request: CC.FindByRequest) => ({
      items: [trunk01, trunk02].filter(
        (trunk) =>
          request.fieldName === "inboundUri" &&
          trunk.inboundUri === request.fieldValue
      )
    })
  },
  numbers: {
    ...apiClient.numbers,
    findBy: async (request: CC.FindByRequest) => ({
      items: numbers.filter(
        (number) =>
          number[request.fieldName as keyof CC.INumber] === request.fieldValue
      )
    })
  }
})

// A location service that finds a registered endpoint for any AOR
const routeFor = (req: MessageRequest) =>
  ({
    findRoutes: sandbox.spy(() => [
      {
        ...r1,
        registeredOn: 1700000000000,
        listeningPoints: req.listeningPoints,
        localnets: req.localnets,
        externalAddrs: req.externalAddrs,
        headers: [] as CT.HeaderModifier[]
      }
    ])
  } as unknown as ILocationService)

// An INVITE as the carrier sends it: the same user in the Request-URI and To
const inviteTo = (user: string) => {
  const req = createRequest({
    fromUser: "447700900123",
    fromDomain: "sip.carrier.example",
    toUser: user,
    toDomain: trunk01.inboundUri,
    requestUriHost: trunk01.inboundUri
  })
  req.message.via[0] = { ...req.message.via[0], received: CARRIER_ADDRESS }
  req.message.authorization = undefined
  return req
}

const metadataOf = (result: Record<string, unknown>) =>
  ((result.route ?? result) as { metadata: Record<string, string> }).metadata

const responseTypeOf = (result: Record<string, unknown>) =>
  (result.message as { responseType: CT.ResponseType }).responseType

describe("@routr/connect/alias_match", () => {
  afterEach(() => sandbox.restore())

  it("routes an alias to its Number's aorLink, recorded as alias", async () => {
    const location = routeFor(inviteTo("01234"))

    const result = await router(location, apiWith([leeds, labelled]))(
      inviteTo("01234"),
      { trunk: trunk01 }
    )

    expect(result).to.have.property("direction", RoutingDirection.FROM_PSTN)
    expect(location.findRoutes).to.have.been.calledWithMatch({
      aor: labelled.aorLink
    })
    expect(metadataOf(result)).to.include({
      "trace.trunk": "trunk-01",
      "trace.numberMatch": "alias"
    })
  })

  it("forwards To as received", async () => {
    let sent: MessageRequest
    const response = {
      send: (message: MessageRequest) => (sent = message)
    } as unknown as Response

    await handleRequest(routeFor(inviteTo("01234")), apiWith([labelled]))(
      inviteTo("01234"),
      response
    )

    expect(sent.message.to.address.uri.user).to.equal("01234")
    expect(sent.metadata).to.have.property("trace.numberMatch", "alias")
  })

  it("answers 404 without the alias", async () => {
    const result = await router(
      routeFor(inviteTo("01234")),
      apiWith([leeds, london])
    )(inviteTo("01234"), { trunk: trunk01 })

    expect(responseTypeOf(result)).to.equal(CT.ResponseType.NOT_FOUND)
  })

  it("compares the alias exactly, case included", async () => {
    const named = numberOf("tel:+442079460018", "GB", trunk01, ["Main"])

    const result = await router(routeFor(inviteTo("main")), apiWith([named]))(
      inviteTo("main"),
      { trunk: trunk01 }
    )

    expect(responseTypeOf(result)).to.equal(CT.ResponseType.NOT_FOUND)
  })

  it("never matches an alias of another Trunk's Number", async () => {
    const elsewhere = numberOf("tel:+390287654321", "IT", trunk02, ["01234"])

    const result = await router(
      routeFor(inviteTo("01234")),
      apiWith([london, elsewhere])
    )(inviteTo("01234"), { trunk: trunk01 })

    expect(responseTypeOf(result)).to.equal(CT.ResponseType.NOT_FOUND)
  })
})

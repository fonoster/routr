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
import { createRequest, r1, signAs } from "./examples"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

// A location service that finds a registered endpoint the request's EdgePort
// can reach. Each call gets its own route: the router adds headers to it
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

const CARRIER_ADDRESS = "192.0.2.10"
const carrierCredentials = { username: "carrier-it", secret: "1234" }

const trunkOf = (ref: string, inboundUri: string, rest = {}): CC.Trunk =>
  ({
    apiVersion: CC.APIVersion.V2,
    ref,
    name: ref,
    inboundUri,
    sendRegister: false,
    ...rest
  } as CC.Trunk)

const carrierAcl = {
  accessControlList: {
    ref: "acl-carrier",
    name: "Carrier",
    allow: [`${CARRIER_ADDRESS}/32`],
    deny: ["0.0.0.0/0"]
  }
}

// Allows the carrier by address
const trunk01 = trunkOf("trunk-01", "carrier-uk.pstn.example", carrierAcl)
// Asks for credentials
const trunk02 = trunkOf("trunk-02", "carrier-it.pstn.example", {
  inboundCredentials: {
    ref: "credentials-carrier-it",
    name: "Carrier IT",
    username: carrierCredentials.username,
    password: carrierCredentials.secret
  }
})
// Normalizes what the carrier sends before routing
const trunk03 = trunkOf("trunk-03", "carrier-de.pstn.example", {
  ...carrierAcl,
  normalizeToE164: true
})
const trunks = [trunk01, trunk02, trunk03]

const numberOf = (
  telUrl: string,
  countryIsoCode: string,
  trunk = trunk01
): CC.INumber => ({
  apiVersion: CC.APIVersion.V2,
  ref: `number-${telUrl.slice(5)}`,
  name: telUrl,
  telUrl,
  // Its own AOR, so the route shows which Number was found
  aorLink: `sip:${telUrl.slice(6)}@sip.local`,
  city: "Unknown",
  country: "Unknown",
  countryIsoCode,
  trunkRef: trunk.ref,
  trunk,
  createdAt: 1700000000,
  updatedAt: 1700000000
})

const london = numberOf("tel:+442079460018", "GB")
const milan = numberOf("tel:+390287654321", "IT")
const cologne = numberOf("tel:+49221123456", "DE")
const sanFrancisco = numberOf("tel:+14155550123", "US")
const trunk01Numbers = [sanFrancisco, cologne, milan, london]

// The Agents, Peers and Domains of config/resources, with the given Numbers
// behind the Trunks above
const apiWith = (numbers: CC.INumber[]): CC.APIClient => ({
  ...apiClient,
  trunks: {
    ...apiClient.trunks,
    findBy: async (request: CC.FindByRequest) => ({
      items: trunks.filter(
        (trunk) =>
          request.fieldName === "inboundUri" &&
          trunk.inboundUri === request.fieldValue
      )
    })
  },
  numbers: {
    ...apiClient.numbers,
    findBy: sandbox.spy(async (request: CC.FindByRequest) => ({
      items: numbers.filter(
        (number) =>
          number[request.fieldName as keyof CC.INumber] === request.fieldValue
      )
    }))
  }
})

// An INVITE as the carrier sends it: the same user in the Request-URI and To
const inviteTo = (user: string, trunk = trunk01, source = CARRIER_ADDRESS) => {
  const req = createRequest({
    fromUser: "447700900123",
    fromDomain: "sip.carrier.example",
    toUser: user,
    toDomain: trunk.inboundUri,
    requestUriHost: trunk.inboundUri
  })
  req.message.via[0] = { ...req.message.via[0], received: source }
  req.message.authorization = undefined
  return req
}

const locationAPI = routeFor(inviteTo("+442079460018"))

const metadataOf = (result: Record<string, unknown>) =>
  ((result.route ?? result) as { metadata: Record<string, string> }).metadata

const messageOf = (result: Record<string, unknown>) =>
  result.message as { responseType: CT.ResponseType }

const responseTypeOf = (result: Record<string, unknown>) =>
  messageOf(result).responseType

describe("@routr/connect/inbound_match", () => {
  afterEach(() => sandbox.restore())

  describe("a Request-URI user that is not the Number's telUrl", () => {
    const forms = [
      { user: "442079460018", number: london, rule: "digits" },
      { user: "02079460018", number: london, rule: "national" },
      { user: "2079460018", number: london, rule: "national" },
      { user: "00442079460018", number: london, rule: "national" },
      {
        user: "02079460018;phone-context=+44",
        number: london,
        rule: "national"
      },
      // Italy keeps the 0 in E.164, Germany drops it
      { user: "0287654321", number: milan, rule: "national" },
      { user: "0221123456", number: cologne, rule: "national" },
      { user: "4155550123", number: sanFrancisco, rule: "national" },
      { user: "14155550123", number: sanFrancisco, rule: "digits" }
    ]

    forms.forEach(({ user, number, rule }) =>
      it(`routes ${user} to ${number.telUrl} by ${rule}`, async () => {
        const location = routeFor(inviteTo(user))

        const result = await router(location, apiWith(trunk01Numbers))(
          inviteTo(user),
          { trunk: trunk01 }
        )

        expect(result).to.have.property("direction", RoutingDirection.FROM_PSTN)
        expect(result.route).to.have.property("user", r1.user)
        expect(metadataOf(result)).to.include({
          "trace.direction": "from-pstn",
          "trace.trunk": "trunk-01",
          "trace.numberMatch": rule
        })
        expect(location.findRoutes).to.have.been.calledWithMatch({
          aor: number.aorLink
        })
      })
    )

    it("reads the Trunk's Numbers once", async () => {
      const api = apiWith(trunk01Numbers)

      await router(locationAPI, api)(inviteTo("02079460018"), {
        trunk: trunk01
      })

      expect(api.numbers.findBy).to.have.been.calledWith({
        fieldName: "trunkRef",
        fieldValue: "trunk-01"
      })
      // The exact lookups for the caller and the callee, then the Trunk's Numbers
      expect(api.numbers.findBy).to.have.been.calledThrice
    })

    it("uses the user as received, not as normalizeToE164 left it", async () => {
      // normalizeToE164 reads 2079460018 as the Egyptian number +2079460018
      const onTrunk03 = numberOf("tel:+442079460018", "GB", trunk03)
      let sent: MessageRequest
      const response = {
        send: (message: MessageRequest) => (sent = message)
      } as unknown as Response

      const location = routeFor(inviteTo("2079460018", trunk03))

      await handleRequest(location, apiWith([onTrunk03]))(
        inviteTo("2079460018", trunk03),
        response
      )

      expect(location.findRoutes).to.have.been.calledWithMatch({
        aor: onTrunk03.aorLink
      })
      expect(sent.metadata).to.have.property("trace.numberMatch", "national")
    })
  })

  describe("an exact match", () => {
    it("routes as before, recorded as exact", async () => {
      const result = await router(locationAPI, apiWith(trunk01Numbers))(
        inviteTo("+442079460018"),
        { trunk: trunk01 }
      )

      expect(result).to.have.property("direction", RoutingDirection.FROM_PSTN)
      expect(metadataOf(result)).to.have.property("trace.numberMatch", "exact")
    })

    it("is still forbidden when the Number belongs to another Trunk", async () => {
      const elsewhere = numberOf("tel:+14155550123", "US", trunk02)

      const result = await router(locationAPI, apiWith([london, elsewhere]))(
        inviteTo("+14155550123"),
        { trunk: trunk01 }
      )

      expect(responseTypeOf(result)).to.equal(CT.ResponseType.FORBIDDEN)
    })
  })

  describe("no Number of the Trunk matches", () => {
    it("answers 404 for an ending of a Number", async () => {
      const result = await router(locationAPI, apiWith(trunk01Numbers))(
        inviteTo("79460018"),
        { trunk: trunk01 }
      )

      expect(result).to.not.have.property("direction")
      expect(messageOf(result)).to.deep.equal({
        responseType: CT.ResponseType.NOT_FOUND,
        reasonPhrase: "No Number found for 79460018"
      })
      // Only what recordingMetadata(trunk) gives: nothing for a Trunk that
      // doesn't record
      expect(metadataOf(result)).to.deep.equal({})
    })

    it("asks for the recording when the Trunk does", async () => {
      const traced = { ...trunk01, trace: { enabled: true } }

      const result = await router(locationAPI, apiWith(trunk01Numbers))(
        inviteTo("99999"),
        { trunk: traced }
      )

      expect(metadataOf(result)).to.have.property("trace.record", "trunk-01")
    })

    it("never looks for the Number in the To header", async () => {
      const req = inviteTo("99999")
      req.message.to.address.uri.user = "+442079460018"

      const result = await router(locationAPI, apiWith(trunk01Numbers))(req, {
        trunk: trunk01
      })

      expect(responseTypeOf(result)).to.equal(CT.ResponseType.NOT_FOUND)
    })

    it("never reaches a Number of another Trunk", async () => {
      const elsewhere = numberOf("tel:+14155550123", "US", trunk02)

      const result = await router(locationAPI, apiWith([london, elsewhere]))(
        inviteTo("4155550123"),
        { trunk: trunk01 }
      )

      expect(responseTypeOf(result)).to.equal(CT.ResponseType.NOT_FOUND)
    })
    ;["", "ZZ"].forEach((countryIsoCode) =>
      it(`matches by digits only with countryIsoCode "${countryIsoCode}"`, async () => {
        const api = apiWith([numberOf("tel:+442079460018", countryIsoCode)])
        const routeTo = (user: string) =>
          router(locationAPI, api)(inviteTo(user), { trunk: trunk01 })

        const national = await routeTo("02079460018")
        const international = await routeTo("00442079460018")
        const digits = await routeTo("442079460018")

        expect(responseTypeOf(national)).to.equal(CT.ResponseType.NOT_FOUND)
        expect(responseTypeOf(international)).to.equal(
          CT.ResponseType.NOT_FOUND
        )
        expect(metadataOf(digits)).to.have.property(
          "trace.numberMatch",
          "digits"
        )
      })
    )

    it("reads a lower-case countryIsoCode", async () => {
      const result = await router(
        locationAPI,
        apiWith([numberOf("tel:+442079460018", "gb")])
      )(inviteTo("02079460018"), { trunk: trunk01 })

      expect(metadataOf(result)).to.have.property(
        "trace.numberMatch",
        "national"
      )
    })
  })

  describe("the Trunk's access check runs before the match", () => {
    it("answers 401 without a challenge from outside the ACL, match or not", async () => {
      const api = apiWith(trunk01Numbers)
      const results = await Promise.all(
        ["99999", "02079460018"].map((user) =>
          router(locationAPI, api)(inviteTo(user, trunk01, "198.51.100.7"), {
            trunk: trunk01
          })
        )
      )

      results.forEach((result) => {
        expect(responseTypeOf(result)).to.equal(CT.ResponseType.UNAUTHORIZED)
        expect(messageOf(result)).to.not.have.property("wwwAuthenticate")
      })
      // Only the exact lookups: the Trunk's Numbers were never read
      expect(api.numbers.findBy).to.not.have.been.calledWithMatch({
        fieldName: "trunkRef"
      })
    })

    it("challenges on a Trunk with credentials, then answers 404", async () => {
      const numbers = [numberOf("tel:+390287654321", "IT", trunk02)]
      const unsigned = inviteTo("99999", trunk02)
      const signed = createRequest({
        fromUser: "447700900123",
        fromDomain: "sip.carrier.example",
        toUser: "99999",
        toDomain: trunk02.inboundUri,
        requestUriHost: trunk02.inboundUri
      })
      signAs(signed, carrierCredentials)

      const challenge = await router(locationAPI, apiWith(numbers))(unsigned, {
        trunk: trunk02
      })
      const notFound = await router(locationAPI, apiWith(numbers))(signed, {
        trunk: trunk02
      })

      expect(responseTypeOf(challenge)).to.equal(CT.ResponseType.UNAUTHORIZED)
      expect(messageOf(challenge)).to.have.property("wwwAuthenticate")
      expect(responseTypeOf(notFound)).to.equal(CT.ResponseType.NOT_FOUND)
    })

    it("answers 403 when the host is no Trunk", async () => {
      const result = await router(
        locationAPI,
        apiWith(trunk01Numbers)
      )(inviteTo("02079460018", trunkOf("none", "nobody.example")))

      expect(responseTypeOf(result)).to.equal(CT.ResponseType.FORBIDDEN)
    })
  })

  describe("the INVITE to the aorLink", () => {
    const forward = async (req: MessageRequest) => {
      let sent: MessageRequest
      const response = {
        send: (message: MessageRequest) => (sent = message)
      } as unknown as Response

      await handleRequest(routeFor(req), apiWith(trunk01Numbers))(req, response)

      return sent
    }

    it("is the one an exact match gets, but for the To user", async () => {
      const exact = await forward(inviteTo("+442079460018"))
      const national = await forward(inviteTo("02079460018"))

      expect(national.message.to.address.uri.user).to.equal("02079460018")
      expect({
        ...national.message,
        to: exact.message.to
      }).to.deep.equal(exact.message)
      expect(national.metadata).to.have.property(
        "trace.numberMatch",
        "national"
      )
      expect(exact.metadata).to.have.property("trace.numberMatch", "exact")
    })

    it("answers 404 through the request handler", async () => {
      const sent = await forward(inviteTo("99999"))

      expect(sent.message).to.deep.equal({
        responseType: CT.ResponseType.NOT_FOUND,
        reasonPhrase: "No Number found for 99999"
      })
      expect(sent.metadata).to.not.have.property("trace.numberMatch")
    })
  })
})

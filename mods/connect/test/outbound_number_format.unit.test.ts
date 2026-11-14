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
import {
  CommonConnect as CC,
  CommonTypes as CT,
  MessageRequest,
  Method,
  Transport
} from "@routr/common"
import { Extensions as E, Response } from "@routr/processor"
import { ILocationService } from "@routr/location"
import { handleRequest } from "../src/handlers/request"
import { createDispatcher } from "../src/service"
import { applyTrunkIdentity } from "../src/tailor"
import { createPAssertedIdentity, trunkIdentity } from "../src/utils"
import { apiClient } from "./mock_apis"
import { createRequest } from "./examples"

const expect = chai.expect
const { E164, E164_WITHOUT_PLUS, NATIONAL, INTERNATIONAL } = CT.NumberFormat

const CARRIER = "sip.carrier-uk.example"

const trunkWith = (settings: Partial<CC.Trunk> = {}): CC.Trunk =>
  ({
    apiVersion: CC.APIVersion.V2,
    ref: "trunk-uk",
    name: "Carrier UK",
    inboundUri: "carrier-uk.pstn.example",
    sendRegister: false,
    uris: [
      {
        user: "",
        host: CARRIER,
        port: 5060,
        transport: Transport.UDP,
        enabled: true,
        weight: 10,
        priority: 10
      }
    ],
    ...settings
  } as CC.Trunk)

const numberOn = (
  trunk: CC.Trunk,
  telUrl = "tel:+442079460018",
  countryIsoCode = "GB"
): CC.INumber =>
  ({
    apiVersion: CC.APIVersion.V2,
    ref: "number-uk",
    name: "Carrier UK main line",
    telUrl,
    aorLink: "sip:1001@sip.local",
    city: "London",
    country: "United Kingdom",
    countryIsoCode,
    trunkRef: trunk.ref,
    trunk
  } as CC.INumber)

// config/resources, with every call of Agent 1001 to the PSTN leaving through
// the given Number
const apiFor = (number: CC.INumber): CC.APIClient => ({
  ...apiClient,
  agents: {
    ...apiClient.agents,
    findBy: async (request: CC.FindByRequest) => ({
      items: (await apiClient.agents.findBy(request)).items.map((agent) => ({
        ...agent,
        domain: {
          ...agent.domain,
          egressPolicies: [{ rule: ".*", numberRef: number.ref, number }]
        }
      }))
    })
  }
})

const noLocation = {
  findRoutes: (): CT.Route[] => []
} as unknown as ILocationService

// The INVITE Agent 1001 sends for a dialed user
const invite = (dialed = "+447700900123") =>
  createRequest({
    fromUser: "1001",
    fromDomain: "sip.local",
    toUser: dialed,
    toDomain: "sip.local"
  })

// What Connect sends toward the Trunk for that INVITE
const call = async (
  trunk: CC.Trunk,
  req = invite(),
  number = numberOn(trunk)
) => {
  let sent: MessageRequest
  const response = {
    send: (message: MessageRequest) => (sent = message)
  } as unknown as Response

  await handleRequest(noLocation, apiFor(number))(req, response)

  return sent
}

const usersOf = (message: MessageRequest) => ({
  requestUri: message.message.requestUri.user,
  to: message.message.to.address.uri.user,
  from: message.message.from.address.uri.user,
  fromUserParam: message.message.from.address.uri.userParam,
  pai: E.getHeaderValue(message, "P-Asserted-Identity"),
  rpid: E.getHeaderValue(message, "Remote-Party-ID")
})

describe("@routr/connect/outbound_number_format", () => {
  describe("the called number: Request-URI and To", () => {
    const cases = [
      { format: E164, prefix: undefined, user: "+447700900123" },
      { format: E164_WITHOUT_PLUS, prefix: undefined, user: "447700900123" },
      { format: E164_WITHOUT_PLUS, prefix: "9", user: "9447700900123" },
      { format: NATIONAL, prefix: undefined, user: "07700900123" },
      { format: NATIONAL, prefix: "9", user: "907700900123" },
      { format: INTERNATIONAL, prefix: undefined, user: "00447700900123" },
      { format: INTERNATIONAL, prefix: "9", user: "900447700900123" }
    ]

    cases.forEach(({ format, prefix, user }) =>
      it(`sends ${user} for ${format} with prefix ${
        prefix ?? "none"
      }`, async () => {
        const sent = usersOf(
          await call(
            trunkWith({
              calledNumberFormat: format,
              calledNumberPrefix: prefix
            })
          )
        )

        expect(sent.requestUri).to.equal(user)
        expect(sent.to).to.equal(user)
        // The caller is left as today
        expect(sent.from).to.equal("1001")
        expect(sent.pai).to.equal(`<sip:+442079460018@${CARRIER};user=phone>`)
        expect(sent.rpid).to.equal(
          `<sip:+442079460018@${CARRIER}>;screen=yes;party=calling`
        )
      })
    )

    it("reads a national number dialed from a GB Number", async () => {
      const sent = usersOf(
        await call(
          trunkWith({ calledNumberFormat: E164 }),
          invite("07700900123")
        )
      )

      expect(sent.requestUri).to.equal("+447700900123")
      expect(sent.to).to.equal("+447700900123")
    })

    it("writes the national form of the Number's own country", async () => {
      const trunk = trunkWith({ calledNumberFormat: NATIONAL })
      const from = (dialed: string, telUrl: string, country: string) =>
        call(trunk, invite(dialed), numberOn(trunk, telUrl, country))

      const italy = await from("+390287654321", "tel:+390212345678", "IT")
      const usa = await from("+14155550123", "tel:+12125550100", "US")
      const germany = await from("+49221123456", "tel:+4930123456", "DE")

      expect(italy.message.requestUri.user).to.equal("0287654321")
      expect(usa.message.requestUri.user).to.equal("4155550123")
      expect(germany.message.requestUri.user).to.equal("0221123456")
    })

    it("sends a number of another calling code in international form under NATIONAL", async () => {
      const trunk = trunkWith({
        calledNumberFormat: NATIONAL,
        calledNumberPrefix: "9"
      })
      const usa = usersOf(await call(trunk, invite("+14155550123")))
      const france = usersOf(await call(trunk, invite("+33142685300")))

      expect(usa.requestUri).to.equal("90014155550123")
      expect(usa.to).to.equal("90014155550123")
      expect(france.requestUri).to.equal("90033142685300")
    })

    it("uses the international prefix of the Number's country", async () => {
      const trunk = trunkWith({ calledNumberFormat: INTERNATIONAL })
      const fromUS = usersOf(
        await call(
          trunk,
          invite("+442079460010"),
          numberOn(trunk, "tel:+14155550123", "US")
        )
      )
      const fromBR = usersOf(
        await call(
          trunkWith({
            calledNumberFormat: INTERNATIONAL,
            calledNumberPrefix: "9"
          }),
          invite("+442079460010"),
          numberOn(trunk, "tel:+551130000000", "BR")
        )
      )

      expect(fromUS.requestUri).to.equal("011442079460010")
      expect(fromUS.to).to.equal("011442079460010")
      // No single international prefix: +E.164 with no prefix
      expect(fromBR.requestUri).to.equal("+442079460010")
    })

    it("sends a # in the prefix as %23", async () => {
      const sent = usersOf(
        await call(
          trunkWith({
            calledNumberFormat: NATIONAL,
            calledNumberPrefix: "9#"
          }),
          invite("+442079460010")
        )
      )

      expect(sent.requestUri).to.equal("9%2302079460010")
      expect(sent.to).to.equal("9%2302079460010")
    })

    it("sends short codes and names as dialed under every format", async () => {
      const formats = [E164, E164_WITHOUT_PLUS, NATIONAL, INTERNATIONAL]
      const dialed = ["911", "112", "*67", "sales"]

      const sent = await Promise.all(
        formats.flatMap((format) =>
          dialed.map(async (user) => ({
            user,
            sent: usersOf(
              await call(
                trunkWith({
                  calledNumberFormat: format,
                  calledNumberPrefix: format === E164 ? undefined : "9"
                }),
                invite(user)
              )
            )
          }))
        )
      )

      sent.forEach(({ user, sent }) => expect(sent.requestUri).to.equal(user))
    })

    it("leaves a short code or a name untouched, with no prefix", async () => {
      const trunk = trunkWith({
        calledNumberFormat: NATIONAL,
        calledNumberPrefix: "9"
      })

      const shortCode = usersOf(await call(trunk, invite("999")))
      const name = usersOf(await call(trunk, invite("frontdesk")))

      expect(shortCode.requestUri).to.equal("999")
      expect(shortCode.to).to.equal("999")
      expect(name.requestUri).to.equal("frontdesk")
      expect(name.to).to.equal("frontdesk")
    })

    it("sends +E.164 under NATIONAL from a Number with no country", async () => {
      const trunk = trunkWith({ calledNumberFormat: NATIONAL })

      const sent = usersOf(
        await call(
          trunk,
          invite("+442079460019"),
          numberOn(trunk, "tel:+442079460018", "")
        )
      )

      expect(sent.requestUri).to.equal("+442079460019")
    })

    it("formats the number as routed, not as normalizeToE164 leaves it", async () => {
      // normalizeToE164 alone would send +2079460018, an Egyptian number
      const sent = usersOf(
        await call(
          trunkWith({ normalizeToE164: true, calledNumberFormat: NATIONAL }),
          invite("2079460018")
        )
      )

      expect(sent.requestUri).to.equal("02079460018")
      expect(sent.to).to.equal("02079460018")
    })
  })

  describe("the caller number: From, P-Asserted-Identity and Remote-Party-ID", () => {
    const rpid = (user: string) =>
      `<sip:${user}@${CARRIER}>;screen=yes;party=calling`
    const cases = [
      { format: E164, prefix: undefined, user: "+442079460018", phone: true },
      {
        format: E164_WITHOUT_PLUS,
        prefix: undefined,
        user: "442079460018",
        phone: false
      },
      {
        format: E164_WITHOUT_PLUS,
        prefix: "8",
        user: "8442079460018",
        phone: false
      },
      {
        format: NATIONAL,
        prefix: undefined,
        user: "02079460018",
        phone: false
      },
      { format: NATIONAL, prefix: "8", user: "802079460018", phone: false },
      {
        format: INTERNATIONAL,
        prefix: "8",
        user: "800442079460018",
        phone: false
      }
    ]

    cases.forEach(({ format, prefix, user, phone }) =>
      it(`sends ${user} for ${format} with prefix ${
        prefix ?? "none"
      }`, async () => {
        const sent = usersOf(
          await call(
            trunkWith({
              rewriteFromWithNumber: true,
              callerNumberFormat: format,
              callerNumberPrefix: prefix
            })
          )
        )

        expect(sent.from).to.equal(user)
        expect(sent.fromUserParam).to.equal(phone ? "phone" : "")
        expect(sent.pai).to.equal(
          `<sip:${user}@${CARRIER}${phone ? ";user=phone" : ""}>`
        )
        expect(sent.rpid).to.equal(rpid(user))
        // The called number is left as dialed
        expect(sent.requestUri).to.equal("+447700900123")
        expect(sent.to).to.equal("+447700900123")
      })
    )

    it("formats the asserted identity and leaves a From that is not a number", async () => {
      // Without rewriteFromWithNumber, From is the Agent's own
      const sent = usersOf(
        await call(trunkWith({ callerNumberFormat: E164_WITHOUT_PLUS }))
      )

      expect(sent.from).to.equal("1001")
      expect(sent.pai).to.equal(`<sip:442079460018@${CARRIER}>`)
      expect(sent.rpid).to.equal(rpid("442079460018"))
    })

    it("wins over normalizeToE164", async () => {
      const sent = usersOf(
        await call(
          trunkWith({
            normalizeToE164: true,
            rewriteFromWithNumber: true,
            callerNumberFormat: NATIONAL
          }),
          invite("447700900123")
        )
      )

      expect(sent.from).to.equal("02079460018")
      // The called number has no format: normalizeToE164 still applies
      expect(sent.requestUri).to.equal("+447700900123")
    })

    it("keeps an anonymous From anonymous while the asserted identity is formatted", () => {
      const trunk = trunkWith({
        rewriteFromWithNumber: true,
        callerNumberFormat: NATIONAL
      })
      const number = numberOn(trunk)
      const req = invite()
      req.message.from.address.uri.user = "anonymous"
      req.message.from.address.uri.host = "anonymous.invalid"
      const route = {
        host: CARRIER,
        port: 5060,
        ...trunkIdentity(trunk, number)
      } as CT.Route

      const out = applyTrunkIdentity(route, req).req

      expect(out.message.from.address.uri.user).to.equal("anonymous")
      expect(out.message.from.address.uri.host).to.equal("anonymous.invalid")
      expect(createPAssertedIdentity(req, trunk, number).value).to.equal(
        `<sip:02079460018@${CARRIER}>`
      )
    })
  })

  describe("a Trunk that sets no format", () => {
    it("adds nothing to the route", () => {
      const trunk = trunkWith({
        normalizeToE164: true,
        calledNumberFormat: CT.NumberFormat.UNSPECIFIED
      })

      expect(trunkIdentity(trunk, numberOn(trunk))).to.deep.equal({
        normalizeToE164: true
      })
    })

    it("sends what it sends today, with and without normalizeToE164", async () => {
      const asRouted = usersOf(await call(trunkWith(), invite("447700900123")))
      const normalized = usersOf(
        await call(trunkWith({ normalizeToE164: true }), invite("447700900123"))
      )

      expect(asRouted.requestUri).to.equal("447700900123")
      expect(asRouted.to).to.equal("447700900123")
      expect(normalized.requestUri).to.equal("+447700900123")
      expect(normalized.to).to.equal("+447700900123")
      expect(asRouted.pai).to.equal(`<sip:+442079460018@${CARRIER};user=phone>`)
    })
  })
  ;[
    { name: "NATIONAL", prefix: "" },
    { name: "NATIONAL with the prefix 9#", prefix: "9%23" }
  ].forEach(({ name, prefix: sentPrefix }) =>
    describe(`a call answered under ${name}`, () => {
      const trunk = trunkWith({
        rewriteFromWithNumber: true,
        calledNumberFormat: NATIONAL,
        callerNumberFormat: NATIONAL,
        ...(sentPrefix
          ? { calledNumberPrefix: "9#", callerNumberPrefix: "9#" }
          : {})
      })
      const agent = { user: "1001", host: "sip.local" }
      const dialed = { user: "+447700900123", host: "sip.local" }

      // What a user agent keeps of a Record-Route entry: the URI
      const routeSetOf = (sent: MessageRequest) =>
        sent.message.recordRoute
          .filter((entry: CT.RecordRoute) =>
            entry.address.uri.user?.startsWith("rfo.")
          )
          .map(
            (entry: CT.RecordRoute) =>
              ({ address: { uri: { ...entry.address.uri } } } as CT.RouteHeader)
          )

      const bye = async (
        from: Partial<CT.SipURI>,
        to: Partial<CT.SipURI>,
        route: CT.RouteHeader[]
      ) => {
        const req = invite()
        req.method = Method.BYE
        req.message.from.address.uri = {
          ...req.message.from.address.uri,
          ...from
        }
        req.message.to.address.uri = { ...req.message.to.address.uri, ...to }
        req.message.to.tag = "callee-tag"
        req.message.route = route
        let sent: MessageRequest
        const response = {
          send: (message: MessageRequest) => (sent = message)
        } as unknown as Response
        await createDispatcher({
          apiClient: apiFor(numberOn(trunk)),
          location: noLocation
        })(req, response)
        return sent
      }

      it("gives the Agent's BYE the identities the carrier saw", async () => {
        const sent = await call(trunk)
        expect(usersOf(sent)).to.include({
          from: `${sentPrefix}02079460018`,
          to: `${sentPrefix}07700900123`
        })

        const out = await bye(agent, dialed, routeSetOf(sent).reverse())

        expect(out.message.from.address.uri).to.include({
          user: `${sentPrefix}02079460018`,
          host: CARRIER
        })
        expect(out.message.to.address.uri).to.include({
          user: `${sentPrefix}07700900123`,
          host: CARRIER
        })
      })

      it("gives the carrier's BYE the Agent's own identities", async () => {
        const sent = await call(trunk)

        const out = await bye(
          { user: `${sentPrefix}07700900123`, host: CARRIER },
          {
            user: `${sentPrefix}02079460018`,
            host: CARRIER,
            userParam: "",
            port: -1
          },
          routeSetOf(sent)
        )

        expect(out.message.from.address.uri).to.include(dialed)
        expect(out.message.to.address.uri).to.include(agent)
      })
    })
  )
})

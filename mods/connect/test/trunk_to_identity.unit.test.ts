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
  Helper,
  MessageRequest,
  Method,
  Route,
  Transport,
  CommonTypes,
  Identity as I
} from "@routr/common"
import { Response } from "@routr/processor"
import { createRequest } from "./examples"
import { applyTrunkIdentity, tailor } from "../src/tailor"
import { createDispatcher } from "../src/service"
import { router } from "../src/router"
import { apiClient, locationAPI } from "./mock_apis"

const expect = chai.expect

const decode = (value: string) =>
  Buffer.from(value, "base64url").toString("utf8")

// A Trunk like the WhatsApp one: outbound URI wa.meta.vc:5061 over TLS,
// rewriteFromWithNumber with fromDomain
const trunkRoute = (rewrite = true): Route => ({
  user: "+15555550188",
  host: "wa.meta.vc",
  port: 5061,
  advertisedHost: "wa.meta.vc",
  advertisedPort: 5061,
  transport: Transport.TLS,
  sessionCount: -1,
  edgePortRef: "edgeport-01",
  listeningPoints: [
    { host: "10.216.30.40", port: 5060, transport: Transport.UDP },
    { host: "10.216.30.40", port: 5060, transport: Transport.TCP },
    { host: "10.216.30.40", port: 5061, transport: Transport.TLS }
  ],
  localnets: ["10.216.30.40/29"],
  externalAddrs: ["203.0.113.10"],
  ...(rewrite
    ? { rewriteFrom: { user: "+15555550100", host: "wa-1.pstn.example.com" } }
    : {})
})

// A Peer (Roomr) INVITE to the callee through the Trunk, To at Routr's address
const peerInvite = (): MessageRequest => {
  const req = createRequest({
    fromDomain: "default",
    fromUser: "roomr",
    toDomain: "10.216.30.40",
    toUser: "+15555550188",
    requestUriHost: "10.216.30.40",
    dodNumber: "+15555550100"
  })
  req.listeningPoints = trunkRoute().listeningPoints
  req.localnets = ["10.216.30.40/29"]
  req.externalAddrs = ["203.0.113.10"]
  req.message.route = []
  req.message.to.address.uri.port = -1
  req.message.to.tag = "callee-tag"
  return req
}

const trunkTo = { user: "+15555550188", host: "wa.meta.vc", port: 5061 }
const callerTo = { user: "+15555550188", host: "10.216.30.40", port: -1 }

// What a UA keeps of a Record-Route entry under RFC 3261 section 12.1.2: the URI
const uriOnly = (rr: CommonTypes.RecordRoute): CommonTypes.RouteHeader =>
  ({ address: { uri: { ...rr.address.uri } } } as CommonTypes.RouteHeader)

describe("@routr/connect To toward a Trunk with rewriteFromWithNumber", () => {
  it("puts To at the Trunk URI's host and port, with its tag", () => {
    const invite = peerInvite()
    const { req } = applyTrunkIdentity(trunkRoute(), invite)
    expect(req.message.to.address.uri).to.include(trunkTo)
    // No transport parameter of the Trunk's is added
    expect(req.message.to.address.uri.transportParam).to.equal(
      invite.message.to.address.uri.transportParam
    )
    expect(req.message.to.tag).to.equal("callee-tag")
  })

  it("makes To's host and port those of the Request-URI", () => {
    const out = tailor(trunkRoute(), peerInvite())
    expect(out.message.to.address.uri.host).to.equal(
      out.message.requestUri.host
    )
    expect(out.message.to.address.uri.port).to.equal(
      out.message.requestUri.port
    )
  })

  it("records the To change in the Record-Route mapping, with the port", () => {
    const out = tailor(trunkRoute(), peerInvite())
    const values = I.decodeIdentityUser(
      out.message.recordRoute[0].address.uri.user
    )
    expect(values).to.have.keys("rfo", "rfn", "rco", "rcn")
    expect(decode(values.rco)).to.equal("+15555550188@10.216.30.40")
    expect(decode(values.rcn)).to.equal("+15555550188@wa.meta.vc:5061")
  })

  it("rewrites To even when From is anonymous", () => {
    const invite = peerInvite()
    invite.message.from.address.uri.user = "anonymous"
    invite.message.from.address.uri.host = "anonymous.invalid"
    const { req, recordRouteParameters } = applyTrunkIdentity(
      trunkRoute(),
      invite
    )
    expect(req.message.from.address.uri.host).to.equal("anonymous.invalid")
    expect(req.message.to.address.uri).to.include(trunkTo)
    expect(recordRouteParameters).to.have.keys("rco", "rcn")
  })

  it("puts an agent's To at the Trunk's host and port", () => {
    // An agent calls a number at its Routr Domain
    const invite = createRequest({
      fromUser: "1001",
      fromDomain: "sip.acme.com",
      toUser: "+15555550188",
      toDomain: "sip.acme.com"
    })
    invite.message.to.address.uri.port = -1
    const { req } = applyTrunkIdentity(trunkRoute(), invite)
    expect(req.message.to.address.uri).to.include(trunkTo)
  })

  it("leaves To as it is on a Trunk without rewriteFromWithNumber", () => {
    const invite = peerInvite()
    const out = tailor(trunkRoute(false), invite)
    expect(out.message.to).to.deep.equal(invite.message.to)
  })

  it("leaves To as it is on a call from a Trunk to an agent", async () => {
    const invite = createRequest({
      fromUser: "+19195551212",
      fromDomain: "newyork1.voip.ms",
      toUser: "+17066041487",
      toDomain: "newyork1.voip.ms",
      requestUriHost: "trunk01.acme.com"
    })
    const { route } = await router(locationAPI, apiClient)(invite)
    // The route toward the agent carries no Trunk identity settings
    const { req } = applyTrunkIdentity(route as Route, Helper.deepCopy(invite))
    expect(req.message.to).to.deep.equal(invite.message.to)
  })

  describe("in-dialog requests", () => {
    const dispatch = createDispatcher({ apiClient, location: locationAPI })
    const invite = tailor(trunkRoute(), peerInvite())
    // The entries this EdgePort added: one per interface, toward the Trunk first
    const added = invite.message.recordRoute.slice(0, 2)

    const forward = async (req: MessageRequest) => {
      const sent: MessageRequest[] = []
      const res = {
        send: (m: MessageRequest) => sent.push(m)
      } as unknown as Response
      await dispatch(req, res)
      expect(sent).to.have.lengthOf(1)
      return sent[0]
    }

    const bye = (
      from: CommonTypes.SipURI,
      to: CommonTypes.SipURI,
      route: CommonTypes.RouteHeader[]
    ) => {
      const req = peerInvite()
      req.method = Method.BYE
      req.message.from.address.uri = { ...from }
      req.message.to.address.uri = { ...to }
      req.message.route = route
      return req
    }

    const trunkFrom = {
      user: "+15555550100",
      host: "wa-1.pstn.example.com",
      userParam: "phone",
      port: -1
    }

    it("gives the caller's BYE the To the Trunk saw", async () => {
      // The caller's Route set: the Record-Route URIs, reversed
      const out = await forward(
        bye(
          { user: "roomr", host: "default", port: 5060 },
          callerTo,
          added.map(uriOnly).reverse()
        )
      )
      expect(out.message.to.address.uri).to.include(trunkTo)
    })

    it("gives the Trunk's BYE the caller's own To as its From", async () => {
      // The Trunk's Route set: the Record-Route URIs, in order
      const out = await forward(bye(trunkTo, trunkFrom, added.map(uriOnly)))
      expect(out.message.from.address.uri).to.include(callerTo)
    })
  })
})

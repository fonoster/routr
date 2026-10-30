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
  MessageRequest,
  Method,
  Route,
  Transport,
  CommonTypes,
  Identity as I
} from "@routr/common"
import { Alterations as A, Response } from "@routr/processor"
import { createRequest } from "./examples"
import { tailor } from "../src/tailor"
import { createDispatcher } from "../src/service"
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

// A Peer (Roomr) INVITE to the callee through the Trunk
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
  return req
}

const callerFrom = { user: "roomr", host: "default" }
const callerTo = { user: "+15555550188", host: "10.216.30.40" }

// What a UA keeps of a Record-Route entry under RFC 3261 section 12.1.2: the URI
const uriOnly = (rr: CommonTypes.RecordRoute): CommonTypes.RouteHeader =>
  ({ address: { uri: { ...rr.address.uri } } } as CommonTypes.RouteHeader)

describe("@routr/connect identity mapping in the Record-Route URI", () => {
  const invite = tailor(trunkRoute(), peerInvite())
  // The entries this EdgePort added: one per interface, toward the Trunk first
  const added = invite.message.recordRoute.slice(0, 2)

  it("writes the mapping in the URI user part of each Record-Route entry it adds", () => {
    expect(added).to.have.lengthOf(2)
    added.forEach((rr: CommonTypes.RecordRoute) => {
      expect(rr.address.uri.user).to.match(/^rfo\.[A-Za-z0-9_-]+\.rfn\./)
      const values = I.decodeIdentityUser(rr.address.uri.user)
      expect(values).to.have.keys("rfo", "rfn", "rco", "rcn")
      expect(rr.address.uri.user).to.equal(
        `rfo.${values.rfo}.rfn.${values.rfn}.rco.${values.rco}.rcn.${values.rcn}`
      )
      // The caller's From in the fixture names port 5060
      expect(decode(values.rfo)).to.equal("roomr@default:5060")
      expect(decode(values.rfn)).to.equal(
        "+15555550100@wa-1.pstn.example.com;user=phone"
      )
      // Only r2=on stays a header parameter
      expect(rr.parameters).to.deep.equal({ r2: "on" })
    })
  })

  describe("in-dialog requests", () => {
    const dispatch = createDispatcher({ apiClient, location: locationAPI })

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
      req.message.to.tag = "callee-tag"
      req.message.route = route
      return req
    }

    it("gives the caller's BYE the From and To the Trunk saw", async () => {
      // The caller's Route set: the Record-Route URIs, reversed
      const out = await forward(
        bye(
          { ...callerFrom, port: -1 },
          { ...callerTo, port: -1 },
          added.map(uriOnly).reverse()
        )
      )
      expect(out.message.from.address.uri).to.include({
        user: "+15555550100",
        host: "wa-1.pstn.example.com",
        userParam: "phone",
        port: -1
      })
      expect(out.message.to.address.uri).to.include({
        user: "+15555550188",
        host: "wa.meta.vc",
        port: 5061
      })
    })

    it("gives the Trunk's BYE the caller's own From and To", async () => {
      // The Trunk's Route set: the Record-Route URIs, in order
      // The Trunk knows the callee at its own host and port
      const out = await forward(
        bye(
          { user: "+15555550188", host: "wa.meta.vc", port: 5061 },
          {
            user: "+15555550100",
            host: "wa-1.pstn.example.com",
            userParam: "phone",
            port: -1
          },
          added.map(uriOnly)
        )
      )
      expect(out.message.from.address.uri).to.include(callerTo)
      expect(out.message.to.address.uri).to.include(callerFrom)
    })
  })

  it("leaves Record-Route as before on a Trunk without rewrites", () => {
    const req = peerInvite()
    const out = tailor(trunkRoute(false), req)
    expect(out.message.recordRoute).to.deep.equal([
      {
        address: {
          uri: {
            host: "203.0.113.10",
            port: 5061,
            transportParam: Transport.TLS,
            lrParam: true
          }
        },
        parameters: { r2: "on" }
      },
      {
        address: {
          uri: {
            host: "203.0.113.10",
            port: 5060,
            transportParam: Transport.TCP,
            lrParam: true
          }
        },
        parameters: { r2: "on" }
      },
      ...req.message.recordRoute
    ])
  })

  describe("ports", () => {
    const withTo = (to: CommonTypes.SipURI) => {
      const req = peerInvite()
      req.message.to.address.uri = { ...req.message.to.address.uri, ...to }
      return req
    }
    const mappingOf = (original: MessageRequest, altered: MessageRequest) =>
      I.decodeIdentityUser(
        A.addSelfRecordRoute(
          trunkRoute(false),
          A.identityRewriteParameters(original, altered)
        )(altered).message.recordRoute[0].address.uri.user
      )

    it("writes the port of a rewritten identity that has one", () => {
      const original = withTo({ ...callerTo, port: -1 })
      const altered = withTo({
        user: "+15555550188",
        host: "wa.meta.vc",
        port: 5061
      })
      const values = mappingOf(original, altered)
      expect(decode(values.rcn)).to.equal("+15555550188@wa.meta.vc:5061")
      expect(decode(values.rco)).to.equal("+15555550188@10.216.30.40")
    })

    it("records a To that changes only its port", () => {
      const original = withTo({ ...callerTo, port: 5060 })
      const altered = withTo({ ...callerTo, port: 5070 })
      const values = mappingOf(original, altered)
      expect(decode(values.rco)).to.equal("+15555550188@10.216.30.40:5060")
      expect(decode(values.rcn)).to.equal("+15555550188@10.216.30.40:5070")
    })
  })
})

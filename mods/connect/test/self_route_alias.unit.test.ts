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
  CommonTypes
} from "@routr/common"
import { Response } from "@routr/processor"
import { createRequest } from "./examples"
import { tailor } from "../src/tailor"
import { createDispatcher } from "../src/service"
import { apiClient, locationAPI } from "./mock_apis"

const expect = chai.expect

// A Trunk with outbound URI wa.meta.vc:5061 over TLS
const trunkRoute: Route = {
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
  externalAddrs: ["203.0.113.10"]
}

const routeTo = (host: string, port?: number, transport?: Transport) =>
  ({
    address: {
      uri: { host, port, lrParam: true, transportParam: transport }
    }
  } as CommonTypes.RouteHeader)

// A Peer (Roomr) INVITE that names Routr by its service name in the Route
const peerRequest = (
  route: CommonTypes.RouteHeader[],
  aliases?: string[]
): MessageRequest => {
  const req = createRequest({
    fromDomain: "default",
    fromUser: "roomr",
    toDomain: "routr",
    toUser: "+15555550188",
    requestUriHost: "routr",
    dodNumber: "+15555550100"
  })
  req.listeningPoints = trunkRoute.listeningPoints
  req.localnets = ["10.216.30.40/29"]
  req.externalAddrs = ["203.0.113.10"]
  req.message.route = route
  if (aliases) {
    // Set through a cast so the fixture doesn't depend on the type
    ;(req as unknown as { aliases: string[] }).aliases = aliases
  }
  return req
}

const routeHosts = (req: MessageRequest) =>
  req.message.route.map((r) => r.address.uri.host)

describe("@routr/connect self routes named by an alias", () => {
  it("removes a Route that names an alias and sends the request to the Trunk", () => {
    const out = tailor(
      trunkRoute,
      peerRequest([routeTo("routr", 5060)], ["routr"])
    )
    expect(routeHosts(out)).to.not.include("routr")
    expect(out.message.requestUri.host).to.equal("wa.meta.vc")
    expect(out.message.requestUri.port).to.equal(5061)
  })

  it("compares aliases case-insensitively", () => {
    const out = tailor(
      trunkRoute,
      peerRequest([routeTo("routr", 5060)], ["ROUTR"])
    )
    expect(routeHosts(out)).to.not.include("routr")
  })

  it("still removes a Route to a localnets IP or an external address", () => {
    const out = tailor(
      trunkRoute,
      peerRequest(
        [routeTo("10.216.30.40", 5060), routeTo("203.0.113.10", 5060)],
        ["routr"]
      )
    )
    expect(out.message.route).to.have.lengthOf(0)
  })

  it("keeps a Route that names another host, in order", () => {
    const out = tailor(
      trunkRoute,
      peerRequest(
        [
          routeTo("proxy.carrier.example"),
          routeTo("routr", 5060),
          routeTo("edge.carrier.example")
        ],
        ["routr"]
      )
    )
    expect(routeHosts(out)).to.deep.equal([
      "proxy.carrier.example",
      "edge.carrier.example"
    ])
  })

  it("keeps an alias on a port no listening point uses for its transport", () => {
    const out = tailor(
      trunkRoute,
      peerRequest([routeTo("routr", 5070)], ["routr"])
    )
    expect(routeHosts(out)).to.deep.equal(["routr"])
  })

  it("keeps a Route that names Routr when the request carries no aliases", () => {
    const out = tailor(trunkRoute, peerRequest([routeTo("routr", 5060)]))
    expect(routeHosts(out)).to.deep.equal(["routr"])
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

    const bye = (aliases?: string[]) => {
      const req = peerRequest(
        [
          routeTo("routr", 5060, Transport.UDP),
          routeTo("proxy.carrier.example")
        ],
        aliases
      )
      req.method = Method.BYE
      req.message.to.tag = "callee-tag"
      return req
    }

    it("removes the alias at the top of a BYE's route set", async () => {
      const out = await forward(bye(["routr"]))
      expect(routeHosts(out)).to.deep.equal(["proxy.carrier.example"])
    })

    it("keeps it when the request carries no aliases", async () => {
      const out = await forward(bye())
      expect(routeHosts(out)).to.deep.equal(["routr", "proxy.carrier.example"])
    })
  })
})

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
import { request, route } from "@routr/processor/test/examples"
import {
  MessageRequest,
  Method,
  Route,
  Transport,
  CommonTypes,
  Helper
} from "@routr/common"
import { handleRegister } from "../src/handlers/register"
import { createDispatcher } from "../src/service"
import { Extensions as E, Response } from "@routr/processor"
import { Helper as H } from "@routr/location"
import { createRequest, r1 } from "./examples"
import { router } from "../src/router"
import { apiClient, locationAPI } from "./mock_apis"
import {
  findResource,
  getUntrustedHeadersToStrip,
  isFromTrustedEdgePort
} from "../src/utils"
import { DEFAULT_UNTRUSTED_HEADERS_TO_STRIP } from "../src/envs"
import { RoutingDirection } from "../src/types"
import { CommonConnect as CC } from "@routr/common"
import { ILocationService } from "@routr/location"
import { handleRequest } from "../src/handlers/request"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/connect", () => {
  afterEach(() => sandbox.restore())

  it("updates a request for inter-domain routing", () => {
    // Test tailor method
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tailor = require("../src/tailor").tailor
    const tailoredRequest = tailor(route as Route, request as MessageRequest)
    const tailerRequestUri = tailoredRequest.message.requestUri
    const messageRequestUri = tailoredRequest.message.requestUri

    expect(tailerRequestUri.user).to.equal(messageRequestUri.user)
    expect(tailerRequestUri.host).to.equal(messageRequestUri.host)
    expect(tailerRequestUri.port).to.equal(messageRequestUri.port)
    expect(tailoredRequest.message.via).to.be.lengthOf(3)
    expect(tailoredRequest.message.maxForwards.maxForwards).to.be.equal(69)
  })

  it("handles a register request", (done) => {
    const location = {
      addRoute: () => {
        // noop
      }
    }
    const addRoute = sandbox.spy(location, "addRoute")
    const response = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      sendRegisterOk: (_: MessageRequest) => {
        expect(addRoute).to.have.been.calledOnce
        done()
      }
    } as Response

    handleRegister(apiClient, location as unknown as ILocationService)(
      request,
      response
    )
  })

  describe("requests carrying X-Edgeport-Ref", () => {
    const trust = { refs: ["edgeport-02"], addresses: ["10.0.0.0/24"] }

    const withEdgePortRef = (
      req: MessageRequest,
      value: string,
      received?: string
    ) => {
      const r = E.addHeader(Helper.deepCopy(req), {
        name: CommonTypes.ExtraHeader.EDGEPORT_REF,
        value
      })
      if (received) r.message.via[0].received = received
      return r
    }

    it("takes the fast path when forwarded by a trusted peer edgeport", async () => {
      const req = withEdgePortRef(request, "edgeport-02", "10.0.0.5")
      const createRouteFromLastMessage = sandbox.spy(
        H,
        "createRouteFromLastMessage"
      )
      const location = { findRoutes: () => [route] }
      const findRoutes = sandbox.spy(location, "findRoutes")
      const response = {
        send: () => {
          // noop
        }
      } as unknown as Response

      await handleRequest(
        location as unknown as ILocationService,
        undefined,
        trust
      )(req, response)

      expect(createRouteFromLastMessage).to.have.been.calledOnce
      expect(findRoutes).to.not.have.been.called
    })

    it("ignores a forged X-Edgeport-Ref with the default config", async () => {
      // Default config trusts no peer edgeport: the header is removed and the
      // request is routed normally (pstn to agent here)
      const req = withEdgePortRef(
        createRequest({
          fromUser: "+19195551212",
          fromDomain: "newyork1.voip.ms",
          toUser: "+17066041487",
          toDomain: "newyork1.voip.ms",
          requestUriHost: "trunk01.acme.com"
        }),
        "edgeport-02",
        // Inside trunk01's access control list, so the call is let through
        "127.0.0.1"
      )
      const createRouteFromLastMessage = sandbox.spy(
        H,
        "createRouteFromLastMessage"
      )
      const location = {
        findRoutes: () => [
          {
            ...r1,
            listeningPoints: req.listeningPoints,
            localnets: req.localnets,
            externalAddrs: req.externalAddrs
          }
        ]
      }
      const findRoutes = sandbox.spy(location, "findRoutes")
      let sent: MessageRequest
      const response = {
        send: (r: MessageRequest) => {
          sent = r
        }
      } as unknown as Response

      await handleRequest(location as unknown as ILocationService, apiClient)(
        req,
        response
      )

      expect(createRouteFromLastMessage).to.not.have.been.called
      expect(findRoutes).to.have.been.calledOnce
      expect(E.getHeaderValue(sent, CommonTypes.ExtraHeader.EDGEPORT_REF)).to.be
        .null
    })

    it("rejects an unauthorized relay attempt with a forged X-Edgeport-Ref", async () => {
      // An outside caller claims to be a peer edgeport to send a call to the PSTN
      // without credentials. It must go through the normal access checks.
      const req = withEdgePortRef(
        createRequest({
          fromUser: "asterisk",
          fromDomain: "unknown.com",
          toUser: "+17853178070",
          toDomain: "unknown.com",
          dodNumber: "+18095863314"
        }),
        "edgeport-02",
        "203.0.113.7"
      )
      const createRouteFromLastMessage = sandbox.spy(
        H,
        "createRouteFromLastMessage"
      )
      let sent: { message: { responseType?: string } }
      const response = {
        send: (r: { message: { responseType?: string } }) => {
          sent = r
        }
      } as unknown as Response

      await handleRequest(locationAPI, apiClient, trust)(req, response)

      expect(createRouteFromLastMessage).to.not.have.been.called
      // Challenged like any other unauthenticated peer, not relayed
      expect(sent.message).to.have.property(
        "responseType",
        CommonTypes.ResponseType.UNAUTHORIZED
      )
    })

    it("does not trust a Via host spoofed to a trusted address", async () => {
      // The SIP stack sets "received" to the real source when it differs from
      // the Via host, so a forged Via host does not make the sender trusted
      const req = withEdgePortRef(request, "edgeport-02", "203.0.113.7")
      req.message.via[0].host = "10.0.0.5"

      expect(isFromTrustedEdgePort(req, trust)).to.be.false
    })

    it("decides trust from source address and ref", () => {
      const base = withEdgePortRef(request, "edgeport-02", "10.0.0.5")
      const noRefs = { refs: [] as string[], addresses: ["10.0.0.5"] }

      expect(isFromTrustedEdgePort(base, trust)).to.be.true
      expect(isFromTrustedEdgePort(base, noRefs)).to.be.true
      // Default: nothing trusted
      expect(isFromTrustedEdgePort(base, { refs: [], addresses: [] })).to.be
        .false
      // Refs alone are not enough, since anyone can set the header
      expect(
        isFromTrustedEdgePort(base, { refs: ["edgeport-02"], addresses: [] })
      ).to.be.false
      // Unknown ref from a trusted address
      expect(
        isFromTrustedEdgePort(
          withEdgePortRef(request, "edgeport-99", "10.0.0.5"),
          trust
        )
      ).to.be.false
      // Untrusted address
      expect(
        isFromTrustedEdgePort(
          withEdgePortRef(request, "edgeport-02", "10.0.1.5"),
          trust
        )
      ).to.be.false
      // No header
      const noHeader = Helper.deepCopy(request)
      noHeader.message.via[0].received = "10.0.0.5"
      expect(isFromTrustedEdgePort(noHeader, trust)).to.be.false
      // Hostname source (no "received") does not match a CIDR
      expect(
        isFromTrustedEdgePort(withEdgePortRef(request, "edgeport-02"), trust)
      ).to.be.false
      // An invalid entry is skipped, not fatal
      expect(
        isFromTrustedEdgePort(base, {
          refs: [],
          addresses: ["not-an-ip", "10.0.0.0/24"]
        })
      ).to.be.true
    })
  })

  it("routes a CANCEL via the last-message fast path, without EDGEPORT_REF", async () => {
    // A CANCEL must follow the exact path its INVITE took (RFC 3261 §9.1). It should
    // never be routed as a new call, whether or not it happens to carry EDGEPORT_REF —
    // Asterisk sends it directly, so it never does.
    const req = { ...request, method: Method.CANCEL }
    const createRouteFromLastMessage = sandbox.spy(
      H,
      "createRouteFromLastMessage"
    )
    const location = { findRoutes: () => [route] }
    const findRoutes = sandbox.spy(location, "findRoutes")
    const response = {
      send: () => {
        // noop
      }
    } as unknown as Response

    await handleRequest(location as unknown as ILocationService)(req, response)

    expect(createRouteFromLastMessage).to.have.been.calledOnce
    expect(findRoutes).to.not.have.been.called
  })

  it("REGRESSION: a peer-to-pstn CANCEL with no X-Dod-Number is not rejected", async () => {
    // Reproduces the 2026-08-30 incident: Asterisk's CANCEL for a peer-to-pstn call
    // carries no X-Dod-Number — only the INVITE does — so routing it as a fresh call
    // hit peerToPSTN's required-header check and came back 400. The CANCEL was
    // dropped, the call kept ringing, and answering a moment later connected into a
    // line the caller had already abandoned. The equivalent INVITE is legitimately
    // rejected by the existing "returns Bad Request..." test below; this asserts the
    // CANCEL is not, because it must never reach that check at all.
    const req: MessageRequest = {
      ...createRequest({
        fromUser: "asterisk",
        fromDomain: "unknown.com",
        toUser: "+17853178070",
        toDomain: "unknown.com"
        // dodNumber intentionally omitted, as on Asterisk's real CANCEL
      }),
      method: Method.CANCEL
    }
    let sent: unknown
    const response = {
      send: (message: unknown) => {
        sent = message
      }
    } as unknown as Response

    await handleRequest(locationAPI, apiClient)(req, response)

    // A rejection comes back as { message: { responseType, reasonPhrase } }
    // (createBadRequestResponse); a forwarded CANCEL is a full MessageRequest, whose
    // .message is the SIP message itself and carries no responseType at all.
    expect(sent).to.have.property("message")
    expect(
      (sent as { message: { responseType?: string } }).message
    ).to.not.have.property("responseType")
  })

  it("handles a request from agent to agent in the same domain", async () => {
    const req = createRequest({
      fromDomain: "sip.local",
      fromUser: "1001",
      toDomain: "sip.local",
      toUser: "1002"
    })
    const result = await router(locationAPI, apiClient)(req)

    expect(result.route).to.be.not.null
    expect(result.route).to.have.property("user", r1.user)
    expect(result.route).to.have.property("host", r1.host)
    expect(result.route).to.not.have.property("headers")
  })

  it("handles a request from agent to pstn", async () => {
    const req = createRequest({
      fromUser: "1001",
      fromDomain: "sip.local",
      toUser: "17853178070",
      toDomain: "sip.local"
    })
    const result = await router(locationAPI, apiClient)(req)

    expect(result.route).to.be.not.null
    expect(result.route).to.have.property("user", "pbx-1")
    expect(result.route).to.have.property("host", "sip.provider.net")
    expect(result.route).to.have.property("port", 7060)
    expect(result.route).to.have.property("transport", Transport.UDP)
    expect(result.route)
      .to.have.property("headers")
      .to.be.an("array")
      .lengthOf(5)
  })

  it("flags the call for recording when the trunk asks for it", async () => {
    const req = createRequest({
      fromUser: "1001",
      fromDomain: "sip.local",
      toUser: "17853178070",
      toDomain: "sip.local"
    })
    const agent = (
      await apiClient.agents.findBy({
        fieldName: "username",
        fieldValue: "1001"
      })
    ).items[0] as CC.Agent
    const trunk = agent.domain.egressPolicies[0].number.trunk

    const before = await router(locationAPI, apiClient)(req)
    expect((before.route as Route).metadata).to.not.have.property("routr.trace")

    trunk.extended = { ...trunk.extended, recordMessages: true }
    const after = await router(locationAPI, apiClient)(req)
    expect((after.route as Route).metadata).to.have.property(
      "routr.trace",
      trunk.ref
    )
    delete trunk.extended.recordMessages
  })

  it("handles a request from pstn to agent or peer", async () => {
    const req = createRequest({
      fromUser: "+19195551212",
      fromDomain: "newyork1.voip.ms",
      toUser: "+17066041487",
      toDomain: "newyork1.voip.ms",
      requestUriHost: "trunk01.acme.com"
    })
    const result = await router(locationAPI, apiClient)(req)

    expect(result.route).to.be.not.null
    expect(result.route).to.have.property("user", r1.user)
    expect(result.route).to.have.property("host", r1.host)
    expect(result.route).to.have.property("port", r1.port)
    expect(result.route).to.have.property("transport", r1.transport)
    expect(result.route)
      .to.have.property("headers")
      .to.be.an("array")
      .lengthOf(1)
  })

  it("handles a request from peer to pstn", async () => {
    const req = createRequest({
      fromUser: "asterisk",
      fromDomain: "unknown.com",
      toUser: "+17853178070",
      toDomain: "unknown.com",
      dodNumber: "+18095863314"
    })
    const reqWithUpdatedAuth = Helper.deepCopy(req)
    reqWithUpdatedAuth.message.authorization.response =
      "09f30fe20face5e168ca7dafcbf154c0"

    const result = await router(locationAPI, apiClient)(reqWithUpdatedAuth)

    expect(result.route).to.be.not.null
    expect(result.route)
      .to.have.property("headers")
      .to.be.an("array")
      .lengthOf(5)
  })

  it("returns Bad Request when X-Dod-Number is missing for peer to pstn", async () => {
    const req = createRequest({
      fromUser: "asterisk",
      fromDomain: "unknown.com",
      toUser: "+17853178070",
      toDomain: "unknown.com"
      // dodNumber intentionally omitted
    })
    const reqWithUpdatedAuth = Helper.deepCopy(req)
    reqWithUpdatedAuth.message.authorization.response =
      "09f30fe20face5e168ca7dafcbf154c0"

    const result = await router(locationAPI, apiClient)(reqWithUpdatedAuth)

    expect(result).to.not.have.property("direction")
    expect(result)
      .to.have.property("message")
      .to.have.property("responseType", CommonTypes.ResponseType.BAD_REQUEST)
  })

  it("returns Not Found when the X-Dod-Number resource does not exist", async () => {
    const req = createRequest({
      fromUser: "asterisk",
      fromDomain: "unknown.com",
      toUser: "+17853178070",
      toDomain: "unknown.com",
      dodNumber: "+10000000000"
    })
    const reqWithUpdatedAuth = Helper.deepCopy(req)
    reqWithUpdatedAuth.message.authorization.response =
      "09f30fe20face5e168ca7dafcbf154c0"

    const result = await router(locationAPI, apiClient)(reqWithUpdatedAuth)

    expect(result).to.not.have.property("direction")
    expect(result)
      .to.have.property("message")
      .to.have.property("responseType", CommonTypes.ResponseType.NOT_FOUND)
  })

  it("strips spoofed platform headers from a pstn request", async () => {
    const req = createRequest({
      fromUser: "+19195551212",
      fromDomain: "newyork1.voip.ms",
      toUser: "+17066041487",
      toDomain: "newyork1.voip.ms",
      requestUriHost: "trunk01.acme.com"
    })
    req.message.extensions.push(
      { name: "X-App-Ref", value: "someone-elses-app" },
      { name: "x-access-key-id", value: "WO-victim" },
      { name: "X-Call-Direction", value: "peer-to-pstn" },
      { name: "X-Is-Api-Originated-Type", value: "true" }
    )
    let sent: MessageRequest
    const response = {
      send: (r: MessageRequest) => {
        sent = r
      }
    } as unknown as Response

    const location = {
      findRoutes: () => [
        {
          ...r1,
          listeningPoints: req.listeningPoints,
          localnets: req.localnets,
          externalAddrs: req.externalAddrs
        }
      ]
    } as unknown as ILocationService

    await handleRequest(location, apiClient)(req, response)

    expect(E.getHeaderValue(sent, "X-App-Ref")).to.be.null
    expect(E.getHeaderValue(sent, "X-Access-Key-Id")).to.be.null
    expect(E.getHeaderValue(sent, "X-Is-Api-Originated-Type")).to.be.null
    // Routr's own X-Call-Direction replaces the spoofed one
    const directions = sent.message.extensions.filter(
      (ext: CommonTypes.Extension) =>
        ext.name.toLowerCase() === "x-call-direction"
    )
    expect(directions).to.be.lengthOf(1)
    expect(directions[0].value).to.equal(RoutingDirection.FROM_PSTN)
    // Unrelated headers are untouched
    expect(E.getHeaderValue(sent, "User-Agent")).to.not.be.null
  })

  it("keeps platform headers from an authenticated peer", async () => {
    const req = createRequest({
      fromUser: "asterisk",
      fromDomain: "unknown.com",
      toUser: "+17853178070",
      toDomain: "unknown.com",
      dodNumber: "+18095863314"
    })
    req.message.authorization.response = "09f30fe20face5e168ca7dafcbf154c0"
    req.message.extensions.push(
      { name: "X-App-Ref", value: "app-01" },
      { name: "X-Access-Key-Id", value: "WO00000000" }
    )
    let sent: MessageRequest
    const response = {
      send: (r: MessageRequest) => {
        sent = r
      }
    } as unknown as Response

    await handleRequest(locationAPI, apiClient)(req, response)

    expect(E.getHeaderValue(sent, "X-App-Ref")).to.equal("app-01")
    expect(E.getHeaderValue(sent, "X-Access-Key-Id")).to.equal("WO00000000")
    expect(E.getHeaderValue(sent, CommonTypes.ExtraHeader.DOD_NUMBER)).to.equal(
      "+18095863314"
    )
  })

  it("selects which headers to strip by source", () => {
    const headers = DEFAULT_UNTRUSTED_HEADERS_TO_STRIP
    expect(
      getUntrustedHeadersToStrip(RoutingDirection.FROM_PSTN, false, headers)
    ).to.deep.equal(headers)
    expect(
      getUntrustedHeadersToStrip(RoutingDirection.PEER_TO_PSTN, false, headers)
    ).to.be.empty
    expect(
      getUntrustedHeadersToStrip(RoutingDirection.AGENT_TO_PEER, false, headers)
    ).to.be.empty

    // A verified Connect Token keeps the client's X-App-Ref, nothing else
    const withToken = getUntrustedHeadersToStrip(
      RoutingDirection.AGENT_TO_PEER,
      true,
      headers
    )
    expect(withToken).to.not.include("X-App-Ref")
    expect(withToken).to.include("X-Access-Key-Id")
    expect(withToken).to.include("X-Edgeport-Ref")
    expect(withToken).to.have.lengthOf(headers.length - 1)
  })

  describe("peer to pstn with a Number bound to an access key", () => {
    const boundApiClient = (accessKeyId: string): CC.APIClient => ({
      ...apiClient,
      numbers: {
        ...apiClient.numbers,
        findBy: async (r: CC.FindByRequest) => {
          const res = await apiClient.numbers.findBy(r)
          return {
            ...res,
            items: res.items.map((n: CC.INumber) => ({
              ...n,
              extended: { accessKeyId }
            }))
          }
        }
      } as CC.ServiceAPI<CC.INumber>
    })

    const peerRequest = (accessKeyId?: string) => {
      const req = createRequest({
        fromUser: "asterisk",
        fromDomain: "unknown.com",
        toUser: "+17853178070",
        toDomain: "unknown.com",
        dodNumber: "+18095863314"
      })
      req.message.authorization.response = "09f30fe20face5e168ca7dafcbf154c0"
      if (accessKeyId) {
        req.message.extensions.push({
          name: CommonTypes.ExtraHeader.ACCESS_KEY_ID,
          value: accessKeyId
        })
      }
      return req
    }

    it("routes when X-Access-Key-Id matches the Number's", async () => {
      const result = await router(
        locationAPI,
        boundApiClient("WO00000000")
      )(peerRequest("WO00000000"))
      expect(result).to.have.property(
        "direction",
        RoutingDirection.PEER_TO_PSTN
      )
      expect(result.route).to.be.not.null
    })

    it("returns Forbidden when X-Access-Key-Id does not match", async () => {
      const result = await router(
        locationAPI,
        boundApiClient("WO00000000")
      )(peerRequest("WO-other"))
      expect(result).to.not.have.property("direction")
      expect(result)
        .to.have.property("message")
        .to.have.property("responseType", CommonTypes.ResponseType.FORBIDDEN)
    })

    it("returns Forbidden when X-Access-Key-Id is missing", async () => {
      const result = await router(
        locationAPI,
        boundApiClient("WO00000000")
      )(peerRequest())
      expect(result)
        .to.have.property("message")
        .to.have.property("responseType", CommonTypes.ResponseType.FORBIDDEN)
    })
  })

  it("gets resource by domainUri and userpart", async () => {
    const r1 = await findResource(apiClient, "sip.local", "1001")
    // Domain with xxx reference does not exist
    const r2 = await findResource(apiClient, "sip.local2", "+17066041487")
    const r3 = await findResource(apiClient, "sip.localx", "1001")
    expect(r1).to.have.property("username", "1001")
    expect(r2).to.have.property("telUrl", "tel:+17066041487")
    expect(r3).to.not.exist
  })

  describe("in-dialog requests", () => {
    // A request inside a dialog carries the To tag and a Route back to this EdgePort
    const inDialog = (
      method: Method,
      fromDomain = "sip.local",
      fromUser = "1001"
    ) => {
      const req = createRequest({
        fromDomain,
        fromUser,
        toDomain: "10.111.221.22",
        toUser: "sipp",
        requestUriHost: "10.111.221.22"
      })
      req.method = method
      req.message.to.tag = "callee-tag"
      req.message.route = [
        {
          address: {
            uri: {
              host: "10.100.42.127",
              port: 5060,
              lrParam: true,
              transportParam: Transport.UDP
            }
          }
        } as CommonTypes.RouteHeader
      ]
      return req
    }

    const dispatch = createDispatcher({ apiClient, location: locationAPI })

    const capture = () => {
      const calls: { name: string; message?: MessageRequest }[] = []
      const res = {
        send: (m: MessageRequest) => calls.push({ name: "send", message: m }),
        sendMethodNotAllowed: () =>
          calls.push({ name: "sendMethodNotAllowed" }),
        sendNotFound: () => calls.push({ name: "sendNotFound" }),
        sendTemporarilyUnavailable: () =>
          calls.push({ name: "sendTemporarilyUnavailable" }),
        sendInternalServerError: () =>
          calls.push({ name: "sendInternalServerError" })
      } as unknown as Response
      return { res, calls }
    }

    const expectForwardedAlongTheRouteSet = (
      calls: { name: string; message?: MessageRequest }[],
      original: MessageRequest
    ) => {
      expect(calls).to.have.lengthOf(1)
      expect(calls[0].name).to.equal("send")
      const out = calls[0].message
      // Request-URI untouched: the remote target, not a trunk or an agent
      expect(out.message.requestUri.host).to.equal(
        original.message.requestUri.host
      )
      expect(out.message.requestUri.user).to.equal(
        original.message.requestUri.user
      )
      // Our own Route was consumed, nothing else was added to the route set
      expect(out.message.route).to.have.lengthOf(0)
      expect(out.message.maxForwards.maxForwards).to.equal(
        original.message.maxForwards.maxForwards - 1
      )
      // No new-call treatment: no gateway auth, no asserted identity rewrite
      expect(E.getHeaderValue(out, CommonTypes.ExtraHeader.GATEWAY_AUTH)).to.not
        .exist
    }

    it("forwards an agent's re-INVITE along the route set instead of routing it to the PSTN", async () => {
      const req = inDialog(Method.INVITE)
      const { res, calls } = capture()
      await dispatch(req, res)
      expectForwardedAlongTheRouteSet(calls, req)
    })

    it("forwards a REFER from the provider side instead of failing with 500", async () => {
      const req = inDialog(Method.REFER, "sip.provider.net", "+17853178070")
      const { res, calls } = capture()
      await dispatch(req, res)
      expectForwardedAlongTheRouteSet(calls, req)
    })

    it("forwards an in-dialog NOTIFY but still refuses one outside a dialog", async () => {
      const inside = inDialog(Method.NOTIFY)
      const first = capture()
      await dispatch(inside, first.res)
      expectForwardedAlongTheRouteSet(first.calls, inside)

      const outside = inDialog(Method.NOTIFY)
      delete outside.message.to.tag
      const second = capture()
      await dispatch(outside, second.res)
      expect(second.calls.map((c) => c.name)).to.deep.equal([
        "sendMethodNotAllowed"
      ])
    })

    it("refuses a REFER outside a dialog", async () => {
      const outside = inDialog(Method.REFER)
      delete outside.message.to.tag
      const { res, calls } = capture()
      await dispatch(outside, res)
      expect(calls.map((c) => c.name)).to.deep.equal(["sendMethodNotAllowed"])
    })

    it("still routes an initial INVITE, which has no To tag, as a new call", async () => {
      const req = createRequest({
        fromDomain: "sip.local",
        fromUser: "1001",
        toDomain: "sip.local",
        toUser: "17853178070"
      })
      const { res, calls } = capture()
      await dispatch(req, res)
      expect(calls).to.have.lengthOf(1)
      expect(calls[0].name).to.equal("send")
      // Routed: the Request-URI now points at the trunk
      expect(calls[0].message.message.requestUri.host).to.equal(
        "sip.provider.net"
      )
    })

    it("forwards BYE as before", async () => {
      const req = inDialog(Method.BYE)
      const { res, calls } = capture()
      await dispatch(req, res)
      expectForwardedAlongTheRouteSet(calls, req)
    })
  })
})

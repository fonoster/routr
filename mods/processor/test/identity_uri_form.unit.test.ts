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
import { createPSTNMessage, request } from "./examples"
import { CommonTypes as CT, Identity as I } from "@routr/common"
import { Alterations as A } from "../src"

const expect = chai.expect

const encode = (s: string) => Buffer.from(s).toString("base64url")

// The mapping an INVITE from the caller (1001@sip.local) to a WhatsApp callee
// through a Trunk would leave in Record-Route
const mapping = {
  rfo: encode("1001@sip.local"),
  rfn: encode("+18295863314@sip.provider.net;user=phone"),
  rco: encode("+15555550188@10.216.30.40"),
  rcn: encode("+15555550188@wa.meta.vc:5061")
}

const userPart = (m: Record<string, string>) =>
  Object.entries(m)
    .map(([name, value]) => `${name}.${value}`)
    .join(".")

const uri = (user: string, host: string, port = -1): CT.SipURI => ({
  user,
  host,
  port
})

const caller = uri("1001", "sip.local")
const callee = uri("+15555550188", "10.216.30.40")
const number = uri("+18295863314", "sip.provider.net")
const calleeAtTrunk = uri("+15555550188", "wa.meta.vc", 5061)

// An in-dialog request whose first Route entry is this EdgePort
const inDialog = (
  from: CT.SipURI,
  to: CT.SipURI,
  route: { user?: string; parameters?: Record<string, string> }
) => {
  const req = createPSTNMessage(request, { from: "x", to: "y" })
  req.message.from.address.uri = { ...from }
  req.message.to.address.uri = { ...to }
  req.message.route[0].address.uri.user = route.user ?? ""
  req.message.route[0].parameters = route.parameters ?? null
  return req
}

describe("@routr/processor/identity in the Route URI user part", () => {
  it("gives a request from the caller the From and To the Trunk saw", () => {
    const r = A.swapIdentityFromRouteSet(
      inDialog(caller, callee, { user: userPart(mapping) })
    )
    expect(r.message.from.address.uri).to.include({
      user: "+18295863314",
      host: "sip.provider.net",
      userParam: "phone",
      port: -1
    })
    expect(r.message.to.address.uri).to.include({
      user: "+15555550188",
      host: "wa.meta.vc",
      port: 5061
    })
  })

  it("gives a request from the Trunk the caller's original From and To", () => {
    const r = A.swapIdentityFromRouteSet(
      inDialog(calleeAtTrunk, number, { user: userPart(mapping) })
    )
    // rco has no port, so the URI has none
    expect(r.message.from.address.uri).to.include({
      user: "+15555550188",
      host: "10.216.30.40",
      port: -1
    })
    expect(r.message.to.address.uri).to.include({
      user: "1001",
      host: "sip.local",
      port: -1
    })
    expect(r.message.to.address.uri.userParam).to.equal(undefined)
  })

  it("leaves the port alone when the mapping is in header parameters", () => {
    const r = A.swapIdentityFromRouteSet(
      inDialog(calleeAtTrunk, number, { parameters: mapping })
    )
    expect(r.message.from.address.uri).to.include({
      user: "+15555550188",
      host: "10.216.30.40",
      port: 5061
    })
  })

  it("swaps once, from the user part, when the entry carries both forms", () => {
    const r = A.swapIdentityFromRouteSet(
      inDialog(caller, callee, {
        user: userPart(mapping),
        parameters: {
          ...mapping,
          rfn: encode("+15555550111@other.example.net")
        }
      })
    )
    expect(r.message.from.address.uri).to.include({
      user: "+18295863314",
      host: "sip.provider.net"
    })
  })

  it("ignores a user part of another form and reads the header parameters", () => {
    const r = A.swapIdentityFromRouteSet(
      inDialog(caller, callee, { user: "roomr", parameters: mapping })
    )
    expect(r.message.from.address.uri).to.include({
      user: "+18295863314",
      host: "sip.provider.net"
    })
  })

  it("ignores the mapping on a Route entry of another EdgePort", () => {
    const req = inDialog(caller, callee, { user: userPart(mapping) })
    req.message.route[0].address.uri.host = "192.0.2.10"
    const r = A.swapIdentityFromRouteSet(req)
    expect(r.message.from.address.uri).to.deep.equal(caller)
    expect(r.message.to.address.uri).to.deep.equal(callee)
  })

  it("leaves a request without a mapping untouched", () => {
    const req = inDialog(caller, callee, {})
    expect(A.swapIdentityFromRouteSet(req)).to.deep.equal(req)
  })
})

describe("@routr/common/identity decodeIdentity", () => {
  it("reads the port of a host name", () => {
    expect(
      I.decodeIdentity(encode("+15555550188@wa.meta.vc:5061"))
    ).to.deep.equal({
      user: "+15555550188",
      host: "wa.meta.vc",
      port: 5061,
      userParam: undefined
    })
  })

  it("reads the port of a bracketed IPv6 host", () => {
    expect(I.decodeIdentity(encode("alice@[::1]:5060"))).to.include({
      user: "alice",
      host: "[::1]",
      port: 5060
    })
  })

  it("decodes a value without a port as before", () => {
    expect(
      I.decodeIdentity(encode("+18295863314@sip.provider.net;user=phone"))
    ).to.deep.equal({
      user: "+18295863314",
      host: "sip.provider.net",
      userParam: "phone"
    })
    expect(I.decodeIdentity(encode("bob@[::1]"))).to.deep.equal({
      user: "bob",
      host: "[::1]",
      userParam: undefined
    })
  })
})

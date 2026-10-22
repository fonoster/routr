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
import { CommonConnect as CC } from "@routr/common"
import { agentsLoader } from "../src/loaders/agents"
import { peersLoader } from "../src/loaders/peers"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/simpledata/loaders", () => {
  afterEach(() => sandbox.restore())

  it("preserves a zero Agent maxContacts instead of rewriting it as unlimited", () => {
    const agent = agentsLoader(
      {
        apiVersion: CC.APIVersion.V2BETA1,
        kind: CC.Kind.AGENT,
        ref: "agent-01",
        metadata: { name: "Zero Contact Agent" },
        spec: {
          username: "1001",
          maxContacts: 0
        }
      } as CC.UserConfig,
      []
    )

    expect(agent.maxContacts).to.equal(0)
  })

  it("defaults a missing Agent maxContacts to unlimited", () => {
    const agent = agentsLoader(
      {
        apiVersion: CC.APIVersion.V2BETA1,
        kind: CC.Kind.AGENT,
        ref: "agent-01",
        metadata: { name: "Unlimited Agent" },
        spec: {
          username: "1001"
        }
      } as CC.UserConfig,
      []
    )

    expect(agent.maxContacts).to.equal(-1)
  })

  it("preserves a zero Peer maxContacts instead of rewriting it as unlimited", () => {
    const peer = peersLoader(
      {
        apiVersion: CC.APIVersion.V2BETA1,
        kind: CC.Kind.PEER,
        ref: "peer-01",
        metadata: { name: "Zero Contact Peer" },
        spec: {
          username: "peer",
          aor: "sip:peer@sip.local",
          maxContacts: 0
        }
      } as CC.UserConfig,
      []
    )

    expect(peer.maxContacts).to.equal(0)
  })

  it("defaults a missing Peer maxContacts to unlimited", () => {
    const peer = peersLoader(
      {
        apiVersion: CC.APIVersion.V2BETA1,
        kind: CC.Kind.PEER,
        ref: "peer-01",
        metadata: { name: "Unlimited Peer" },
        spec: {
          username: "peer",
          aor: "sip:peer@sip.local"
        }
      } as CC.UserConfig,
      []
    )

    expect(peer.maxContacts).to.equal(-1)
  })
})

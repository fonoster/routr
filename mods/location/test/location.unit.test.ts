/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
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
import * as Routes from "./route_examples"
import { getConfig } from "../src/config/get_config"
import { FindRoutesRequest } from "../src/types"
import { CommonTypes as CT } from "@routr/common"
import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import Locator from "../src/location"
import MemoryStore from "../src/memory_store"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/location", () => {
  afterEach(() => sandbox.restore())

  it("gets a simple route", async () => {
    const locator = new Locator(new MemoryStore())
    const labels1 = new Map<string, string>([["priority", "1"]])
    const labels2 = new Map<string, string>([
      ["priority", "2"],
      ["region", "us-east01"]
    ])

    locator.addRoute({ aor: "sip:1001@sip.local", route: Routes.simpleRoute01 })
    locator.addRoute({ aor: "sip:1001@sip.local", route: Routes.simpleRoute02 })

    const findRoutesRequest1 = {
      callId: "3848276298220188511",
      aor: "sip:1001@sip.local"
    }
    const findRoutesRequest2 = {
      callId: "3848276298220188511",
      aor: "sip:1001@sip.local",
      labels: labels1
    }
    const findRoutesRequest3 = {
      callId: "a-non-existent-call-id",
      aor: "sip:1001@sip.local",
      labels: labels2
    }

    const result1 = await locator.findRoutes(findRoutesRequest1)
    const result2 = await locator.findRoutes(findRoutesRequest2)
    const result3 = await locator.findRoutes(findRoutesRequest3)

    expect(result1.length).to.be.equal(2)
    expect(result1[0]).to.have.property("user").to.be.equal("1001")
    expect(result2.length).to.be.equal(1)
    expect(result2[0]).to.have.property("user").to.be.equal("1001")
    expect(result3.length).to.be.equal(0)
  })

  it("find next backend using least-sessions", async () => {
    const locator = new Locator(new MemoryStore())
    locator.addRoute({
      aor: "sip:voice_ls@sip.local",
      route: Routes.voiceBackendRoute01
    })
    locator.addRoute({
      aor: "sip:voice_ls@sip.local",
      route: Routes.voiceBackendRoute02
    })
    locator.addRoute({
      aor: "sip:voice_ls@sip.local",
      route: Routes.voiceBackendRoute03
    })
    locator.addRoute({
      aor: "sip:voice_ls@sip.local",
      route: Routes.voiceBackendRoute04
    })
    locator.addRoute({
      aor: "sip:voice_ls@sip.local",
      route: Routes.voiceBackendRoute05
    })

    const findRoutesRequest1: FindRoutesRequest = {
      callId: "3848276298220188511",
      aor: "sip:voice_ls@sip.local",
      backend: {
        withSessionAffinity: true,
        balancingAlgorithm: CT.LoadBalancingAlgorithm.LEAST_SESSIONS
      }
    }

    expect((await locator.findRoutes(findRoutesRequest1))[0])
      .to.be.have.property("sessionCount")
      .to.be.equal(Routes.voiceBackendRoute05.sessionCount)
  })

  it("find next backend using round-robin", async () => {
    const locator = new Locator(new MemoryStore())
    locator.addRoute({
      aor: "sip:voice_rr@sip.local",
      route: Routes.voiceBackendRoute05
    })
    locator.addRoute({
      aor: "sip:voice_rr@sip.local",
      route: Routes.voiceBackendRoute04
    })
    locator.addRoute({
      aor: "sip:voice_rr@sip.local",
      route: Routes.voiceBackendRoute03
    })
    locator.addRoute({
      aor: "sip:voice_rr@sip.local",
      route: Routes.voiceBackendRoute02
    })
    locator.addRoute({
      aor: "sip:voice_rr@sip.local",
      route: Routes.voiceBackendRoute01
    })

    const findRoutesRequest1 = {
      callId: "01",
      aor: "sip:voice_rr@sip.local",
      backend: {
        withSessionAffinity: false,
        balancingAlgorithm: CT.LoadBalancingAlgorithm.ROUND_ROBIN
      }
    }
    const findRoutesRequest2 = {
      callId: "02",
      aor: "sip:voice_rr@sip.local",
      backend: {
        withSessionAffinity: false,
        balancingAlgorithm: CT.LoadBalancingAlgorithm.ROUND_ROBIN
      }
    }
    const findRoutesRequest3 = {
      callId: "03",
      aor: "sip:voice_rr@sip.local",
      backend: {
        withSessionAffinity: false,
        balancingAlgorithm: CT.LoadBalancingAlgorithm.ROUND_ROBIN
      }
    }
    const findRoutesRequest4 = {
      callId: "04",
      aor: "sip:voice_rr@sip.local",
      backend: {
        withSessionAffinity: false,
        balancingAlgorithm: CT.LoadBalancingAlgorithm.ROUND_ROBIN
      }
    }
    const findRoutesRequest5 = {
      callId: "05",
      aor: "sip:voice_rr@sip.local",
      backend: {
        withSessionAffinity: false,
        balancingAlgorithm: CT.LoadBalancingAlgorithm.ROUND_ROBIN
      }
    }
    const findRoutesRequest6 = {
      callId: "06",
      aor: "sip:voice_rr@sip.local",
      backend: {
        withSessionAffinity: false,
        balancingAlgorithm: CT.LoadBalancingAlgorithm.ROUND_ROBIN
      }
    }
    const findRoutesRequest7 = {
      callId: "07",
      aor: "sip:voice_rr@sip.local",
      backend: {
        withSessionAffinity: false,
        balancingAlgorithm: CT.LoadBalancingAlgorithm.ROUND_ROBIN
      }
    }

    expect((await locator.findRoutes(findRoutesRequest1))[0])
      .to.be.have.property("user")
      .to.be.equal("voice01")
    expect((await locator.findRoutes(findRoutesRequest2))[0])
      .to.be.have.property("user")
      .to.be.equal("voice02")
    expect((await locator.findRoutes(findRoutesRequest3))[0])
      .to.be.have.property("user")
      .to.be.equal("voice03")
    expect((await locator.findRoutes(findRoutesRequest4))[0])
      .to.be.have.property("user")
      .to.be.equal("voice04")
    expect((await locator.findRoutes(findRoutesRequest5))[0])
      .to.be.have.property("user")
      .to.be.equal("voice05")
    expect((await locator.findRoutes(findRoutesRequest6))[0])
      .to.be.have.property("user")
      .to.be.equal("voice01")
    expect((await locator.findRoutes(findRoutesRequest7))[0])
      .to.be.have.property("user")
      .to.be.equal("voice02")

    // Observe how we get the same backend since it is the same callId
    expect((await locator.findRoutes(findRoutesRequest7))[0])
      .to.be.have.property("user")
      .to.be.equal("voice02")
  })

  it("find next backend with session affinity enabled", async () => {
    const locator = new Locator(new MemoryStore())
    locator.addRoute({
      aor: "sip:conference@sip.local",
      route: Routes.conferenceWithExpiredRoute
    })
    locator.addRoute({
      aor: "sip:conference@sip.local",
      route: Routes.conferenceBackendRoute02
    })
    locator.addRoute({
      aor: "sip:conference@sip.local",
      route: Routes.conferenceBackendRoute01
    })

    const findRoutesRequest1 = {
      callId: "3848276298220188511",
      aor: "sip:conference@sip.local",
      sessionAffinityRef: "any-session-affinity-ref",
      backend: {
        withSessionAffinity: true,
        balancingAlgorithm: CT.LoadBalancingAlgorithm.LEAST_SESSIONS
      }
    }

    const findRoutesRequest2 = {
      callId: "any-call-id",
      aor: "sip:conference@sip.local",
      sessionAffinityRef: "any-session-affinity-ref",
      backend: {
        withSessionAffinity: true,
        balancingAlgorithm: CT.LoadBalancingAlgorithm.LEAST_SESSIONS
      }
    }

    expect((await locator.findRoutes(findRoutesRequest1))[0])
      .to.have.property("user")
      .to.be.equal("conference01")
    expect((await locator.findRoutes(findRoutesRequest2))[0])
      .to.have.property("user")
      .to.be.equal("conference01")
  })

  it("find next backend using deprecated 'backend:' schema", async () => {
    const locator = new Locator(new MemoryStore())
    locator.addRoute({
      aor: "backend:voice_ls",
      route: Routes.voiceBackendRoute01
    })

    const findRoutesRequest1 = {
      callId: "3848276298220188511",
      aor: "backend:voice_ls",
      backend: {
        withSessionAffinity: true,
        balancingAlgorithm: CT.LoadBalancingAlgorithm.LEAST_SESSIONS,
        ref: "voice_ls"
      }
    }

    expect((await locator.findRoutes(findRoutesRequest1))[0])
      .to.be.have.property("user")
      .to.be.equal("voice01")
  })

  it("gets configuration from file", (done) => {
    const result = getConfig(__dirname + "/../../../config/location.yaml")
    if (result._tag === "Right") {
      const config = result.right
      expect(config).to.have.property("bindAddr")
      done()
    } else {
      done(result.left)
    }
  })
})

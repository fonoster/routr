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
import * as Routes from "./route_examples"
import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import Locator, { CALL_ROUTE_TTL_SECONDS } from "../src/location"
import MemoryStore from "../src/memory_store"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/location/call routes", () => {
  afterEach(() => sandbox.restore())

  it("answers no routes for an unknown AOR, on this lookup and the next", async () => {
    const locator = new Locator(new MemoryStore())
    const request = { aor: "sip:nobody@sip.local", callId: "call-01" }

    expect(await locator.findRoutes(request)).to.deep.equal([])
    // Used to answer 500: the empty answer was stored under the call
    expect(await locator.findRoutes(request)).to.deep.equal([])
  })

  it("keeps a call on its route for a short while, not for the registration", async () => {
    const clock = sandbox.useFakeTimers({ now: Date.now(), toFake: ["Date"] })
    const store = new MemoryStore()
    const locator = new Locator(store)
    const aor = "sip:1001@sip.local"
    await locator.addRoute({
      aor,
      route: Routes.simpleRoute01,
      maxContacts: -1
    })

    const routes = await locator.findRoutes({ aor, callId: "call-01" })

    expect(routes[0]).to.deep.equal(Routes.simpleRoute01)
    expect(await store.get(aor + ":call-01")).to.have.lengthOf(1)

    clock.tick((CALL_ROUTE_TTL_SECONDS + 1) * 1000)

    expect(await store.get(aor + ":call-01")).to.have.lengthOf(0)
    expect(await store.get(aor)).to.have.lengthOf(1)
  })
})

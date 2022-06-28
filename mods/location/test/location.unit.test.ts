/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
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
import chai from 'chai'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'
import Locator from '../src/location'
import MemoryStore from '../src/memory_store'
import {getConfig} from '../src/config/get_config'
import * as Routes from './route_examples'

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox();

describe('@routr/location', () => {
  afterEach(() => sandbox.restore());

  it('gets a simple route', async () => {
    const locator = new Locator(new MemoryStore(), Routes.backends)
    const labels1 = new Map<string, string>([
      ["priority", "1"]
    ])
    const labels2 = new Map<string, string>([
      ["priority", "2"],
      ["region", "us-east01"]
    ])

    locator.addRoute({aor: "sip:1001@sip.local", route: Routes.simpleRoute01})
    locator.addRoute({aor: "sip:1001@sip.local", route: Routes.simpleRoute02})

    const findRoutesRequest1 = {aor: "sip:1001@sip.local"}
    const findRoutesRequest2 = {aor: "sip:1001@sip.local", labels: labels1}
    const findRoutesRequest3 = {aor: "sip:1001@sip.local", labels: labels2}

    expect((await locator.findRoutes(findRoutesRequest1)).length).to.be.equal(2)
    expect((await locator.findRoutes(findRoutesRequest1))[0])
      .to.have.property("user").to.be.equal("1001")

    expect((await locator.findRoutes(findRoutesRequest2)).length).to.be.equal(1)
    expect((await locator.findRoutes(findRoutesRequest2))[0])
      .to.have.property("user").to.be.equal("1001")

    expect((await locator.findRoutes(findRoutesRequest3)).length).to.be.equal(0)
  })

  it('find next backend using least-sessions', async () => {
    const locator = new Locator(new MemoryStore(), Routes.backends)
    locator.addRoute({aor: "backend:voice_ls", route: Routes.voiceBackendRoute01})
    locator.addRoute({aor: "backend:voice_ls", route: Routes.voiceBackendRoute02})
    locator.addRoute({aor: "backend:voice_ls", route: Routes.voiceBackendRoute03})
    locator.addRoute({aor: "backend:voice_ls", route: Routes.voiceBackendRoute04})
    locator.addRoute({aor: "backend:voice_ls", route: Routes.voiceBackendRoute05})

    const findRoutesRequest1 = {aor: "backend:voice_ls"}

    expect((await locator.findRoutes(findRoutesRequest1))[0])
      .to.be.have.property("sessionCount").to.be.equal(5)
  })

  it('find next backend using round-robin', async () => {
    const locator = new Locator(new MemoryStore(), Routes.backends)
    locator.addRoute({aor: "backend:voice_rr", route: Routes.voiceBackendRoute05})
    locator.addRoute({aor: "backend:voice_rr", route: Routes.voiceBackendRoute04})
    locator.addRoute({aor: "backend:voice_rr", route: Routes.voiceBackendRoute03})
    locator.addRoute({aor: "backend:voice_rr", route: Routes.voiceBackendRoute02})
    locator.addRoute({aor: "backend:voice_rr", route: Routes.voiceBackendRoute01})

    const findRoutesRequest1 = {aor: "backend:voice_rr"}

    expect((await locator.findRoutes(findRoutesRequest1))[0])
      .to.be.have.property("user").to.be.equal("voice01")
    expect((await locator.findRoutes(findRoutesRequest1))[0])
      .to.be.have.property("user").to.be.equal("voice02")
    expect((await locator.findRoutes(findRoutesRequest1))[0])
      .to.be.have.property("user").to.be.equal("voice03")
    expect((await locator.findRoutes(findRoutesRequest1))[0])
      .to.be.have.property("user").to.be.equal("voice04")
    expect((await locator.findRoutes(findRoutesRequest1))[0])
      .to.be.have.property("user").to.be.equal("voice05")
    expect((await locator.findRoutes(findRoutesRequest1))[0])
      .to.be.have.property("user").to.be.equal("voice01")
    expect((await locator.findRoutes(findRoutesRequest1))[0])
      .to.be.have.property("user").to.be.equal("voice02")
  })

  it('find next backend with session affinity enabled', async () => {
    const locator = new Locator(new MemoryStore(), Routes.backends)
    locator.addRoute({aor: "backend:conference", route: Routes.conferenceWithExpiredRoute})
    locator.addRoute({aor: "backend:conference", route: Routes.conferenceBackendRoute02})
    locator.addRoute({aor: "backend:conference", route: Routes.conferenceBackendRoute01})

    const findRoutesRequest1 = {aor: "backend:conference"}
    expect((await locator.findRoutes(findRoutesRequest1))[0])
      .to.have.property("user").to.be.equal("conference01")
    expect((await locator.findRoutes(findRoutesRequest1))[0])
      .to.have.property("user").to.be.equal("conference01")
  })

  it('gets configuration from file', (done) => {
    const result = getConfig(__dirname + "/../../../config/location.json")
    if (result._tag === 'Right') {
      const config = result.right

      expect(config).to.have.property("bindAddr")
      expect(config.backends[0])
        .to.have.property("ref").to.be.equal("voice")
      expect(config.backends[0])
        .to.have.property("balancingAlgorithm").to.be.equal("round-robin")
      expect(config.backends[1])
        .to.have.property("ref").to.be.equal("conference")
      expect(config.backends[1])
        .to.have.property("balancingAlgorithm").to.be.equal("least-sessions")
      expect(config.backends[1])
        .to.have.property("sessionAffinity")
        .to.have.property("enabled").to.be.equal(true)
      expect(config.backends[1])
        .to.have.property("sessionAffinity")
        .to.have.property("ref").to.be.equal("room_id")
      done()
    } else {
      done(result.left)
    }
  })
})

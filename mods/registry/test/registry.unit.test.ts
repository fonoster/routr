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
import { Method, Transport } from "@routr/common"
import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import { getConfig } from "../src/config/get_config"
import createRegistrationRequest, {
  getHostFromAddress,
  getPortFromAddress
} from "../src/request"
import { RegistrationEntryStatus, RequestParams } from "../src/types"
import MemoryStore from "../src/memory_store"
import { getUnregisteredTrunks } from "../src/utils"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

const trunks = [
  {
    ref: "tk6t67r1",
    name: "T1",
    region: "us-east1",
    user: "user1",
    host: "sip.provider.net",
    port: 5060,
    transport: Transport.UDP
  },
  {
    ref: "tkxy23kj",
    name: "T2",
    region: "us-east1",
    user: "user1",
    host: "sip.provider.net",
    port: 5061,
    transport: Transport.UDP
  },
  {
    ref: "tkabc3423",
    name: "T3",
    region: "us-east1",
    user: "user1",
    host: "sip.provider3.net",
    port: 5063,
    transport: Transport.SCTP
  }
]

describe("@routr/registry", () => {
  afterEach(() => sandbox.restore())

  it("creates a registration request", () => {
    const requestParams: RequestParams = {
      trunkRef: "tk6t67r1",
      user: "user",
      targetDomain: "sip.provider.net",
      targetAddress: "sip.provider.net:5060",
      proxyAddress: "sip.proxy01.net:5060",
      transport: Transport.TCP,
      methods: [Method.INVITE],
      auth: {
        username: "1001",
        secret: "1234"
      }
    }

    const request = createRegistrationRequest(requestParams)
    const fromAddress = request.message.from
    const fromURI = request.message.from.address.uri
    const toURI = request.message.from.address.uri
    const requestUri = request.message.requestUri
    const route = request?.message?.route[0]?.address.uri
    const extensions = request?.message?.extensions

    expect(extensions[0]?.name).to.be.equal("Allow")
    expect(extensions[0]?.value).to.be.include(Method.INVITE)
    expect(extensions[1]?.name).to.be.equal("CSeq")
    expect(extensions[1]?.value).to.be.include(`${Method.REGISTER}`)
    expect(extensions[2]?.name).to.be.equal("User-Agent")
    expect(extensions[2]?.value).to.be.include("Routr Connect")
    expect(extensions[3]?.name).to.be.equal("Allow-Events")
    expect(extensions[3]?.value).to.be.include("presence")
    expect(extensions[4]?.name).to.be.equal("Proxy-Require")
    expect(extensions[4]?.value).to.be.include("gin")
    expect(extensions[5]?.name).to.be.equal("Require")
    expect(extensions[5]?.value).to.be.include("gin")
    expect(extensions[6]?.name).to.be.equal("Supported")
    expect(extensions[6]?.value).to.be.include("path")
    expect(extensions[7]?.name).to.be.equal("X-Gateway-Auth")
    expect(extensions[7]?.value).to.be.include("MTAwMToxMjM0")

    expect(route.lrParam).to.be.equal(true)
    expect(route.transportParam).to.be.equal(requestParams.transport)
    expect(route.host).to.be.equal(
      getHostFromAddress(requestParams.proxyAddress)
    )
    expect(route.port).to.be.equal(
      getPortFromAddress(requestParams.proxyAddress)
    )

    expect(request.trunkRef).to.be.equal(requestParams.trunkRef)
    expect(request.target).to.be.equal(requestParams.targetAddress)
    expect(request.method).to.be.equal(Method.REGISTER)
    expect(request.transport).to.be.equal(requestParams.transport)

    expect(fromURI.user).to.be.equal(requestParams.user)
    expect(fromURI.host).to.be.equal(requestParams.targetDomain)
    expect(fromURI.transportParam).to.be.equal(requestParams.transport)
    expect(fromURI.secure).to.be.equal(requestParams.secure)
    expect(fromAddress).to.have.property("tag").to.be.lengthOf(8) // TODO: Check the length too

    expect(toURI.user).to.be.equal(requestParams.user)
    expect(toURI.host).to.be.equal(requestParams.targetDomain)
    expect(toURI.transportParam).to.be.equal(requestParams.transport)
    expect(toURI.secure).to.be.equal(requestParams.secure)

    expect(request.message.callId.callId).to.be.not.null
    expect(request.message.contentLength.contentLength).to.be.not.null
    expect(request.message.expires?.expires).to.be.equal(600)
    expect(request.message.maxForwards?.maxForwards).to.be.equal(70)

    expect(requestUri?.transportParam).to.be.equal(requestParams.transport)
    expect(requestUri?.methodParam).to.be.equal(Method.REGISTER)
    expect(requestUri?.secure).to.be.equal(requestParams.secure)
    expect(request.message.messageType).to.be.equal("requestUri")
    expect(requestUri?.user).to.be.equal(requestParams.user)
    expect(requestUri?.host).to.be.equal(
      getHostFromAddress(requestParams.targetAddress)
    )
    expect(requestUri?.port).to.be.equal(
      getPortFromAddress(requestParams.targetAddress)
    )
  })

  it("gets configuration from file", (done) => {
    const result = getConfig(__dirname + "/../../../config/registry.json")
    if (result._tag === "Right") {
      const config = result.right
      expect(config)
        .to.have.property("cache")
        .to.have.property("provider")
        .to.be.equal("memory")
      expect(config.edgePorts[0])
        .to.have.property("address")
        .to.be.equal("edgeport01:5060")
      expect(config.edgePorts[0])
        .to.have.property("region")
        .to.be.equal("us-east1")
      expect(config.edgePorts[1])
        .to.have.property("address")
        .to.be.equal("edgeport02:6060")
      expect(config.edgePorts[1]).to.not.have.property("region")
      done()
    } else {
      done(result.left)
    }
  })

  describe("utils", () => {
    it("getHostFromAddress and getPortFromAddress", () => {
      const address = "sip.local:5060"
      const badAddress = "sip.local"
      expect(getHostFromAddress(address)).to.be.equal("sip.local")
      expect(getPortFromAddress(address)).to.be.equal(5060)
      expect(() => getHostFromAddress(badAddress)).to.throw(
        /malformated address/
      )
      expect(() => getPortFromAddress(badAddress)).to.throw(
        /malformated address/
      )
    })

    it("getUnregisteredTrunks", async () => {
      const store = new MemoryStore()
      store.put("tk6t67r1", {
        trunkRef: "tk6t67r1",
        timeOfEntry: Date.now(),
        retentionTimeInSeconds: 120,
        status: RegistrationEntryStatus.REGISTERED
      })
      store.put("tkxy23kj", {
        trunkRef: "tkxy23kj",
        timeOfEntry: Date.now(),
        retentionTimeInSeconds: 120,
        status: RegistrationEntryStatus.QUARANTINE
      })

      const unregisteredTrunks = await getUnregisteredTrunks(store)(trunks)

      expect(unregisteredTrunks.length).to.equal(1)
      expect(unregisteredTrunks[0])
        .to.have.property("ref")
        .to.equal("tkabc3423")
    })
  })
})

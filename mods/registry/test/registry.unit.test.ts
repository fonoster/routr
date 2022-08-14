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
import {Method, Transport} from "@routr/common"
import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import {getConfig} from "../src/config/get_config"
import createRegistrationRequest, {
  getHostFromAddress,
  getPortFromAddress
} from "../src/request"
import {RequestParams} from "../src/types"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/location", () => {
  afterEach(() => sandbox.restore())

  it("creates a registration request", () => {
    const requestParams: RequestParams = {
      user: "user",
      targetDomain: "sip.provider.net",
      targetAddress: "sip.provider.net:5060",
      proxyAddress: "sip.proxy01.net:5060",
      transport: Transport.TCP,
      allow: [
        Method.INVITE,
        Method.ACK,
        Method.BYE,
        Method.CANCEL,
        Method.REGISTER,
        Method.OPTIONS
      ]
    }

    const request = createRegistrationRequest(requestParams)
    const fromAddress = request.message.from
    const fromURI = request.message.from.address.uri
    const toURI = request.message.from.address.uri
    const requestUri = request.message.requestUri
    const route = request?.message?.route[0]?.address.uri
    const extensions = request?.message?.extensions

    expect(extensions[0]?.name).to.be.equal("CSeq")
    expect(extensions[0]?.value).to.be.include(`${Method.REGISTER}`)
    expect(extensions[1]?.name).to.be.equal("Allow")
    expect(extensions[1]?.value).to.be.include(Method.INVITE)
    expect(extensions[2]?.name).to.be.equal("User-Agent")
    expect(extensions[2]?.value).to.be.include("Routr Connect")
    expect(extensions[3]?.name).to.be.equal("Allow-Events")
    expect(extensions[3]?.value).to.be.include("presence")
    expect(extensions[4]?.name).to.be.equal("Proxy-Require")
    expect(extensions[4]?.value).to.be.include("gin")
    expect(extensions[5]?.name).to.be.equal("Require")
    expect(extensions[5]?.value).to.be.include("gin")

    expect(route.lrParam).to.be.equal(true)
    expect(route.transportParam).to.be.equal(requestParams.transport)
    expect(route.host).to.be.equal(
      getHostFromAddress(requestParams.proxyAddress)
    )
    expect(route.port).to.be.equal(
      getPortFromAddress(requestParams.proxyAddress)
    )

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

    expect(request.message.callId.callId).to.be.lengthOf(15)
    expect(request.message.contentLength.contentLength).to.be.not.null
    expect(request.message.expires?.expires).to.be.equal(600)
    expect(request.message.maxForwards?.maxForwards).to.be.equal(70)

    expect(requestUri?.transportParam).to.be.equal(requestParams.transport)
    expect(requestUri?.methodParam).to.be.equal(Method.REGISTER)
    expect(requestUri?.secure).to.be.equal(requestParams.secure)
    expect(request.message.messageType).to.be.equal("requestUri")
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
      expect(config).to.have.property("bindAddr")
      expect(config)
        .to.have.property("cache")
        .to.have.property("provider")
        .to.be.equal("memory")
      expect(config.edgePorts[0])
        .to.have.property("address")
        .to.be.equal("localhost:5060")
      expect(config.edgePorts[0])
        .to.have.property("region")
        .to.be.equal("us-east1")
      expect(config.edgePorts[1])
        .to.have.property("address")
        .to.be.equal("localhost:5060")
      expect(config.edgePorts[1]).to.not.have.property("region")
      done()
    } else {
      done(result.left)
    }
  })

  describe("registry/utils", () => {
    it("getHostFromAddress + getPortFromAddress", () => {
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
  })
})

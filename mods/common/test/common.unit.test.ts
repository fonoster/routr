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
import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import { getObjectProto } from "../src/service"
import { addressCount, getLocalnetIp, isLocalnet } from "../src/ip_utils"
import { getRedisUrlFromConfig } from "../src/redis"
import { createUnauthorizedResponse, getCredentials } from "../src/auth"
import { ResponseType } from "../src/types"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

const objectProto = {
  name: "processor",
  version: "v2beta1",
  path: __dirname + "/../src/protos/processor.proto"
}

describe("@routr/common", () => {
  afterEach(() => sandbox.restore())

  it("gets Processor object proto", () => {
    expect(getObjectProto(objectProto))
      .to.have.property("Processor")
      .to.have.property("service")
  })

  it("fails to get object proto due to a typo", () => {
    const objectProto2 = { ...objectProto }
    // Introduce a typo
    objectProto2.name = "processo"
    expect(getObjectProto(objectProto2).toString()).to.include(
      "service definition for processo/v2beta1 not found"
    )
  })

  it("converts parameter string to redis url", () => {
    const c1 = { host: "test.local", port: 6380 }
    const c2 = { password: "1234", host: "test.local", port: 6380 }
    const c3 = {
      username: "admin",
      password: "1234",
      host: "test.local",
      port: 6380
    }
    const c4 = {
      secure: true,
      username: "admin",
      password: "1234",
      host: "test.local",
      port: 6380
    }
    expect(getRedisUrlFromConfig(c1)).to.be.equal("redis://test.local:6380")
    expect(getRedisUrlFromConfig(c2)).to.be.equal(
      "redis://:1234@test.local:6380"
    )
    expect(getRedisUrlFromConfig(c3)).to.be.equal(
      "redis://admin:1234@test.local:6380"
    )
    expect(getRedisUrlFromConfig(c4)).to.be.equal(
      "rediss://admin:1234@test.local:6380"
    )
  })

  describe("ip_utils", () => {
    it("ip util for #addressCount", () => {
      expect(addressCount("192.168.1.1/255.255.255.0")).to.be.equal(256)
      expect(addressCount("10.0.0.1")).to.be.equal(1)
      expect(addressCount("10.0.0.1/28")).to.be.equal(16)
      expect(addressCount("0.0.0.0/0")).to.be.equal(4294967296)
      // expect(addressCount('2620::2d0:2df::6/127')).to.be.equal(2)
    })

    // Note: Is not working properly for ipv4
    it("ip util for #isLocalnet", () => {
      const localnets = [
        // '2620::2d0:2df::6/127',
        "192.168.1.2",
        "10.88.1.0/255.255.255.0",
        "192.168.0.1/28"
      ]
      expect(isLocalnet(localnets, "2620::2d0:2df::6"))
      expect(isLocalnet(localnets, "192.168.1.2")).to.be.true
      expect(isLocalnet(localnets, "10.88.1.34")).to.be.true
      expect(isLocalnet(localnets, "192.168.0.14")).to.be.true
      expect(isLocalnet(localnets, "35.196.78.166")).to.be.false
    })

    it("gets the ip of a localnet for a given address", () => {
      const localnets = ["127.0.0.1/8", "192.168.1.3/24"]
      expect(getLocalnetIp(localnets, "192.168.1.6")).to.be.equal("192.168.1.3")
      expect(getLocalnetIp(localnets, "47.132.130.31")).to.be.undefined
      expect(getLocalnetIp(localnets, ".invalid")).to.be.undefined
    })
  })

  describe("authentication", () => {
    afterEach(() => sandbox.restore())

    it("gets credentials by username", () => {
      const users = [
        {
          username: "john",
          secret: "changeme"
        },
        {
          username: "1001",
          secret: "changeme"
        }
      ]

      expect(getCredentials("1001", users))
        .to.have.property("secret")
        .to.be.equal("changeme")
    })

    it("creates an unauthorized response", () => {
      const response = createUnauthorizedResponse("localhost")
      expect(response)
        .to.have.property("message")
        .to.have.property("responseType")
        .to.be.equal(ResponseType.UNAUTHORIZED)
      expect(response)
        .to.have.property("message")
        .to.have.property("wwwAuthenticate")
        .to.have.property("scheme")
        .to.be.equal("Digest")
      expect(response)
        .to.have.property("message")
        .to.have.property("wwwAuthenticate")
        .to.have.property("realm")
        .to.be.equal("localhost")
      expect(response)
        .to.have.property("message")
        .to.have.property("wwwAuthenticate")
        .to.have.property("algorithm")
        .to.be.equal("MD5")
      expect(response)
        .to.have.property("message")
        .to.have.property("wwwAuthenticate")
        .to.have.property("qop")
        .to.be.equal("auth")
      expect(response)
        .to.have.property("message")
        .to.have.property("wwwAuthenticate")
        .to.have.property("nonce")
        .to.be.length(32)
    })
  })
})

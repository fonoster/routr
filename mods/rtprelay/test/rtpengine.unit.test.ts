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
import { createRequest } from "../../connect/test/examples"
import {
  getDirectionFromRequest,
  getDirectionFromResponse,
  getRTPEParams,
  getRTPEParamsByDirection
} from "../src/utils"
import { Direction } from "../src/types"
import { Transport, Helper } from "@routr/common"
import { response } from "./examples"

chai.use(sinonChai)
const sandbox = sinon.createSandbox()
describe("@routr/rtprelay", () => {
  afterEach(() => sandbox.restore())

  it("obtains the direction of the message from a request", async () => {
    const req = createRequest({
      fromUser: "1001",
      fromDomain: "sip.local",
      toUser: "1002",
      toDomain: "sip.local"
    })

    const dir = getDirectionFromRequest(req)
    chai.expect(dir).to.equal("phone-to-phone")
  })

  it("obtains the direction of the message from a response", async () => {
    const dir = getDirectionFromResponse(response)
    chai.expect(dir).to.equal("web-to-phone")
  })

  describe("SRTP toward a phone leg over TLS", () => {
    it("asks for plain RTP toward a phone leg on UDP or TCP", () => {
      chai
        .expect(getRTPEParamsByDirection(Direction.PHONE_TO_PHONE))
        .to.have.property("transport-protocol", "RTP/AVP")
      const webToPhone = getRTPEParamsByDirection(Direction.WEB_TO_PHONE)
      chai.expect(webToPhone).to.have.property("transport-protocol", "RTP/AVP")
      chai.expect(webToPhone.flags).to.include("SDES-no")
    })

    it("asks for SDES-SRTP toward a phone leg on TLS", () => {
      const phoneToPhone = getRTPEParamsByDirection(
        Direction.PHONE_TO_PHONE,
        true
      )
      chai
        .expect(phoneToPhone)
        .to.have.property("transport-protocol", "RTP/SAVP")
      const webToPhone = getRTPEParamsByDirection(Direction.WEB_TO_PHONE, true)
      chai.expect(webToPhone).to.have.property("transport-protocol", "RTP/SAVP")
      chai.expect(webToPhone.flags).to.not.include("SDES-no")
      chai.expect(webToPhone).to.have.property("DTLS", "off")
    })

    it("leaves the browser leg on DTLS-SRTP", () => {
      chai
        .expect(getRTPEParamsByDirection(Direction.PHONE_TO_WEB, true))
        .to.have.property("transport-protocol", "UDP/TLS/RTP/SAVPF")
    })

    it("reads the destination leg from the top Via of the message", () => {
      // The INVITE the EdgePort forwards to a TLS trunk: its own Via, facing
      // the carrier, is on top
      const toTrunk = createRequest({
        fromUser: "1001",
        fromDomain: "sip.local",
        toUser: "12225554000",
        toDomain: "sip.local"
      })
      toTrunk.message.via[0].transport = Transport.TLS
      chai
        .expect(getRTPEParams(toTrunk, getDirectionFromRequest(toTrunk)))
        .to.have.property("transport-protocol", "RTP/SAVP")

      // The 200 OK coming back from the carrier goes to the agent on UDP
      const toAgent = Helper.deepCopy(toTrunk)
      toAgent.sender.transport = Transport.TLS
      toAgent.message.via[0].transport = Transport.UDP
      chai
        .expect(getRTPEParams(toAgent, getDirectionFromResponse(toAgent)))
        .to.have.property("transport-protocol", "RTP/AVP")
    })
  })
})

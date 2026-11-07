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
import { request } from "./examples"
import { Helper as H } from "../src"
import { Transport } from "@routr/common"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/processor/helper", () => {
  afterEach(() => sandbox.restore())

  it("obtains edge interface for and address not in localnets", () => {
    const intf = H.getEdgeInterface({
      ...request,
      endpointIntf: {
        host: "47.131.130.35",
        port: 5060,
        transport: Transport.UDP
      }
    })
    expect(intf).to.have.property("host").to.equal("200.22.21.42")
  })

  it("obtains edge interface for and address in localnets", () => {
    const intf = H.getEdgeInterface({
      ...request,
      endpointIntf: {
        host: "10.100.42.12",
        port: 5060,
        transport: Transport.UDP
      }
    })
    expect(intf).to.have.property("host").to.equal("10.100.42.127")
  })

  it("should fail if routing to internet but finds no external addr", () => {
    const req = JSON.parse(JSON.stringify(request))
    req.externalAddrs = []
    expect(() =>
      H.getEdgeInterface({
        ...req,
        endpointIntf: {
          host: "47.131.130.35",
          port: 5060,
          transport: Transport.UDP
        }
      })
    ).to.throw()
  })
})

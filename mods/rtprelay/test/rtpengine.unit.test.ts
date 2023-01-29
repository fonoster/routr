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
import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import { createRequest } from "../../connect/test/examples"
import { getDirectionFromRequest, getDirectionFromResponse } from "../src/utils"
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
})

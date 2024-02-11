/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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
import { request } from "./examples"
import { Target as T } from "../src"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/processor/target", () => {
  afterEach(() => sandbox.restore())

  it("gets the address of record(aor)", () => {
    expect(T.getAOR(request.message.requestUri)).to.be.equal("sip:sip.local")
    expect(T.getTargetAOR(request)).to.be.equal("sip:1001@sip.local")
  })

  it("gets expires from expires header or contact header", () => {
    // Taking expires from expires header
    expect(T.getTargetExpires(request)).to.be.equal(60)

    // Taking expires from contact header if is different than -1
    const req = { ...request }
    req.message.contact.expires = 600
    expect(T.getTargetExpires(request)).to.be.equal(600)
  })
})

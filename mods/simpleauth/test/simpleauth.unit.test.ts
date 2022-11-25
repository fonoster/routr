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
import { createUnauthorizedResponse, getCredentials } from "../src/utils"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/simpleauth", () => {
  afterEach(() => sandbox.restore())

  it("gets credentials by username", () => {
    const users = [
      {
        username: "john",
        secret: "changeit"
      },
      {
        username: "1001",
        secret: "changeit"
      }
    ]

    expect(getCredentials("1001", users))
      .to.have.property("secret")
      .to.be.equal("changeit")
  })

  it("creates an unauthorized response", () => {
    const response = createUnauthorizedResponse("localhost")
    expect(response)
      .to.have.property("message")
      .to.have.property("responseType")
      .to.be.equal(17)
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

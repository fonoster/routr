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
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://localhost:5432/routr"

import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import { CommonConnect as CC } from "@routr/common"
import { findBy } from "../src/api/find"
import { get } from "../src/api/get"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

const createdAt = new Date(1700000000000)

const agentFromDb = (): Record<string, unknown> => ({
  apiVersion: CC.APIVersion.V2,
  ref: "agent-01",
  name: "John Doe",
  username: "1001",
  privacy: "PRIVATE",
  enabled: true,
  maxContacts: -1,
  expires: 0,
  traceEnabled: false,
  domainRef: null,
  credentialsRef: null,
  domain: null,
  credentials: null,
  createdAt,
  updatedAt: createdAt,
  extended: null
})

const numberFromDb = (
  ref: string,
  telUrl: string
): Record<string, unknown> => ({
  apiVersion: CC.APIVersion.V2,
  ref,
  trunkRef: "trunk-01",
  telUrl,
  name: ref,
  aorLink: "sip:1001@sip.local",
  city: "London",
  country: "United Kingdom",
  countryIsoCode: "GB",
  sessionAffinityHeader: null,
  extraHeaders: null,
  trunk: null,
  createdAt,
  updatedAt: createdAt,
  extended: null
})

describe("@routr/pgdata/api/find", () => {
  afterEach(() => sandbox.restore())

  it("maps FindBy results to DTOs, the same as Get", async () => {
    const callback = sandbox.stub()
    const getCallback = sandbox.stub()

    await findBy(sandbox.stub().resolves([agentFromDb()]), CC.Kind.AGENT)(
      { request: { fieldName: "ref", fieldValue: "agent-01" } } as never,
      callback
    )
    await get(sandbox.stub().resolves(agentFromDb()), CC.Kind.AGENT)(
      { request: { ref: "agent-01" } } as never,
      getCallback
    )

    const [error, response] = callback.firstCall.args
    expect(error).to.be.null
    expect(response.items).to.have.lengthOf(1)
    expect(response.items[0].createdAt).to.equal(1700000000)
    expect(response.items[0].updatedAt).to.equal(1700000000)
    expect(response.items[0]).to.deep.equal(getCallback.firstCall.args[1])
  })

  it("finds the Numbers of a Trunk by trunkRef", async () => {
    const callback = sandbox.stub()
    const operation = sandbox
      .stub()
      .resolves([
        numberFromDb("number-01", "tel:+442079460018"),
        numberFromDb("number-02", "tel:+441134960000")
      ])

    await findBy(operation, CC.Kind.NUMBER)(
      { request: { fieldName: "trunkRef", fieldValue: "trunk-01" } } as never,
      callback
    )

    expect(operation).to.have.been.calledOnce
    expect(operation.firstCall.args[0].where).to.deep.equal({
      trunkRef: "trunk-01"
    })
    const [error, response] = callback.firstCall.args
    expect(error).to.be.null
    expect(
      response.items.map((number: CC.INumber) => number.telUrl)
    ).to.deep.equal(["tel:+442079460018", "tel:+441134960000"])
    expect(response.items[0]).to.include({
      trunkRef: "trunk-01",
      countryIsoCode: "GB"
    })
  })
})

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
import { create } from "../src/api/create"
import { update } from "../src/api/update"
import { del } from "../src/api/delete"
import { findCache } from "../src/cache/find_cache"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

const createdAt = new Date(1700000000000)

const agentRow = (): Record<string, unknown> => ({
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

const domainRow = (): Record<string, unknown> => ({
  apiVersion: CC.APIVersion.V2,
  ref: "domain-01",
  name: "Local",
  domainUri: "sip.local",
  accessControlListRef: null,
  accessControlList: null,
  egressPolicies: [],
  traceEnabled: false,
  createdAt,
  updatedAt: createdAt,
  extended: null
})

const noop = () => sandbox.stub()

describe("@routr/pgdata/api write invalidation", () => {
  beforeEach(() => findCache.clear())
  afterEach(() => sandbox.restore())

  const lookupAgent = (operation: sinon.SinonStub) =>
    findBy(operation, CC.Kind.AGENT)(
      { request: { fieldName: "username", fieldValue: "1001" } } as never,
      noop()
    )

  const lookupDomain = (operation: sinon.SinonStub) =>
    findBy(operation, CC.Kind.DOMAIN)(
      { request: { fieldName: "domainUri", fieldValue: "sip.local" } } as never,
      noop()
    )

  it("queries again after the row is created, updated or deleted", async () => {
    const operation = sandbox.stub().resolves([agentRow()])

    await lookupAgent(operation)
    await lookupAgent(operation)
    expect(operation).to.have.been.calledOnce

    await create(sandbox.stub().resolves(agentRow()), CC.Kind.AGENT)(
      { request: { name: "John Doe", username: "1001" } } as never,
      noop()
    )
    await lookupAgent(operation)
    expect(operation).to.have.been.calledTwice

    await update(sandbox.stub().resolves(agentRow()), CC.Kind.AGENT)(
      { request: { ref: "agent-01", name: "Jane Doe" } } as never,
      noop()
    )
    await lookupAgent(operation)
    expect(operation).to.have.been.calledThrice

    await del(sandbox.stub().resolves(agentRow()), CC.Kind.AGENT)(
      { request: { ref: "agent-01" } } as never,
      noop()
    )
    await lookupAgent(operation)
    expect(operation.callCount).to.equal(4)
  })

  it("leaves Domain entries alone when an Agent is written", async () => {
    const operation = sandbox.stub().resolves([domainRow()])

    await lookupDomain(operation)
    await del(sandbox.stub().resolves(agentRow()), CC.Kind.AGENT)(
      { request: { ref: "agent-01" } } as never,
      noop()
    )
    await lookupDomain(operation)

    expect(operation).to.have.been.calledOnce
  })

  it("drops Agent entries when a Trunk or Credentials they embed is written", async () => {
    const operation = sandbox.stub().resolves([agentRow()])

    await lookupAgent(operation)
    await del(sandbox.stub().resolves({ ref: "trunk-01" }), CC.Kind.TRUNK)(
      { request: { ref: "trunk-01" } } as never,
      noop()
    )
    await lookupAgent(operation)
    expect(operation).to.have.been.calledTwice

    await del(
      sandbox.stub().resolves({ ref: "credentials-01" }),
      CC.Kind.CREDENTIALS
    )({ request: { ref: "credentials-01" } } as never, noop())
    await lookupAgent(operation)
    expect(operation).to.have.been.calledThrice
  })
})

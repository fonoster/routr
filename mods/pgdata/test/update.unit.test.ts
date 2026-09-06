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

import { Prisma } from "@prisma/client"
import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import { CommonConnect as CC } from "@routr/common"
import { prisma } from "../src/db"
import { update } from "../src/api/update"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()
const originalEgressPolicyDeleteMany = prisma.egressPolicy.deleteMany
const originalTrunkURIDeleteMany = prisma.trunkURI.deleteMany

type DomainWithACL = Prisma.DomainGetPayload<{
  include: {
    accessControlList: true
    egressPolicies: {
      include: {
        number: true
      }
    }
  }
}>

const domainFromDb: DomainWithACL = {
  apiVersion: CC.APIVersion.V2,
  ref: "domain-01",
  name: "Local Domain",
  domainUri: "sip.local",
  accessControlListRef: null,
  accessControlList: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  extended: null,
  egressPolicies: []
}

describe("@routr/pgdata/api/update", () => {
  afterEach(() => {
    prisma.egressPolicy.deleteMany = originalEgressPolicyDeleteMany
    prisma.trunkURI.deleteMany = originalTrunkURIDeleteMany
    sandbox.restore()
  })

  it("replaces existing Domain egress policies when the request includes egressPolicies", async () => {
    const deleteMany = sandbox.stub().resolves({ count: 1 })
    prisma.egressPolicy.deleteMany = deleteMany
    const operation = sandbox.stub().resolves(domainFromDb)
    const callback = sandbox.stub()

    await update(operation, CC.Kind.DOMAIN)(
      {
        request: {
          ref: "domain-01",
          name: "Local Domain",
          domainUri: "sip.local",
          egressPolicies: [{ rule: "^1", numberRef: "number-new" }]
        }
      } as never,
      callback
    )

    expect(deleteMany).to.have.been.calledOnceWithExactly({
      where: { domainRef: "domain-01" }
    })
    expect(operation).to.have.been.calledOnce
    expect(
      operation.firstCall.args[0].data.egressPolicies.create
    ).to.deep.equal([{ rule: "^1", numberRef: "number-new" }])
    expect(callback).to.have.been.calledOnceWith(null, sinon.match.object)
  })

  it("does not delete Domain egress policies when egressPolicies is absent", async () => {
    const deleteMany = sandbox.stub().resolves({ count: 0 })
    prisma.egressPolicy.deleteMany = deleteMany
    const operation = sandbox.stub().resolves(domainFromDb)
    const callback = sandbox.stub()

    await update(operation, CC.Kind.DOMAIN)(
      {
        request: {
          ref: "domain-01",
          name: "Local Domain",
          domainUri: "sip.local"
        }
      } as never,
      callback
    )

    expect(deleteMany).to.not.have.been.called
    expect(operation).to.have.been.calledOnce
    expect(callback).to.have.been.calledOnceWith(null, sinon.match.object)
  })

  it("still replaces Trunk URIs when the request includes uris", async () => {
    const deleteMany = sandbox.stub().resolves({ count: 1 })
    prisma.trunkURI.deleteMany = deleteMany
    const createdAt = new Date()
    const operation = sandbox.stub().resolves({
      apiVersion: CC.APIVersion.V2,
      ref: "trunk-01",
      name: "Global Trunk",
      inboundUri: "sip.local",
      sendRegister: false,
      accessControlListRef: null,
      inboundCredentialsRef: null,
      outboundCredentialsRef: null,
      accessControlList: null,
      inboundCredentials: null,
      outboundCredentials: null,
      createdAt,
      updatedAt: createdAt,
      extended: null,
      uris: []
    })
    const callback = sandbox.stub()

    await update(operation, CC.Kind.TRUNK)(
      {
        request: {
          ref: "trunk-01",
          name: "Global Trunk",
          inboundUri: "sip.local",
          uris: [{ host: "new.example", port: 5060 }]
        }
      } as never,
      callback
    )

    expect(deleteMany).to.have.been.calledOnceWithExactly({
      where: { trunkRef: "trunk-01" }
    })
    expect(callback).to.have.been.calledOnceWith(null, sinon.match.object)
  })
})

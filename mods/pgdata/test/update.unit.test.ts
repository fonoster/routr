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

import * as grpc from "@grpc/grpc-js"
import path from "path"
import * as protoLoader from "@grpc/proto-loader"
import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import { CommonConnect as CC } from "@routr/common"
import { protoLoadOptions } from "../../common/src/service"
import { prisma } from "../src/db"
import { create } from "../src/api/create"
import { update } from "../src/api/update"

const expect = chai.expect

// The messages of the alias rules
const taken = (alias: string, ref: string) =>
  `alias "${alias}" is already used by Number ${ref} on this Trunk`
chai.use(sinonChai)
const sandbox = sinon.createSandbox()
const originalEgressPolicyDeleteMany = prisma.egressPolicy.deleteMany
const originalTrunkURIDeleteMany = prisma.trunkURI.deleteMany
const originalNumberFindUnique = prisma.number.findUnique
const originalNumberFindMany = prisma.number.findMany

const PROTOS_DIR = path.join(__dirname, "../../common/src/connect/protos")

// Round-trips a request through the real proto, so the handler sees exactly
// what the server decodes (omitted optional fields absent, lists as [])
const decode = (
  file: string,
  service: string,
  method: "Create" | "Update",
  request: Record<string, unknown>
) => {
  const definition = protoLoader.loadSync(path.join(PROTOS_DIR, file), {
    ...protoLoadOptions,
    includeDirs: [PROTOS_DIR]
  })
  const rpc = (
    definition[service] as Record<
      string,
      protoLoader.MethodDefinition<unknown, unknown>
    >
  )[method]
  return rpc.requestDeserialize(rpc.requestSerialize(request))
}

const DOMAINS = [
  "domains.proto",
  "fonoster.routr.connect.domains.v2beta1.Domains"
]
const TRUNKS = ["trunks.proto", "fonoster.routr.connect.trunks.v2beta1.Trunks"]
const ACLS = ["acl.proto", "fonoster.routr.connect.acl.v2beta1.ACLService"]
const NUMBERS = [
  "numbers.proto",
  "fonoster.routr.connect.numbers.v2beta1.Numbers"
]

const now = new Date()

const domainFromDb: Record<string, unknown> = {
  apiVersion: CC.APIVersion.V2,
  ref: "domain-01",
  name: "Local Domain",
  domainUri: "sip.local",
  accessControlListRef: null,
  accessControlList: null,
  createdAt: now,
  updatedAt: now,
  extended: null,
  egressPolicies: []
}

const trunkFromDb: Record<string, unknown> = {
  apiVersion: CC.APIVersion.V2,
  ref: "trunk-01",
  name: "Global Trunk",
  inboundUri: "sip.local",
  sendRegister: true,
  accessControlListRef: null,
  inboundCredentialsRef: null,
  outboundCredentialsRef: null,
  accessControlList: null,
  inboundCredentials: null,
  outboundCredentials: null,
  createdAt: now,
  updatedAt: now,
  extended: null,
  uris: []
}

const aclFromDb: Record<string, unknown> = {
  apiVersion: CC.APIVersion.V2,
  ref: "acl-01",
  name: "Local ACL",
  allow: ["10.0.0.0/8"],
  deny: ["0.0.0.0/0"],
  createdAt: now,
  updatedAt: now,
  extended: null
}

// number-01 and number-02 share trunk-01; number-03 is alone on trunk-02
const numbersInDb = [
  { ref: "number-01", aliases: ["01234"], trunkRef: "trunk-01" },
  { ref: "number-02", aliases: ["5678"], trunkRef: "trunk-01" },
  { ref: "number-03", aliases: ["01234"], trunkRef: "trunk-02" }
]

const numberFromDb = (ref: string): Record<string, unknown> => ({
  apiVersion: CC.APIVersion.V2,
  name: ref,
  telUrl: "tel:+442079460018",
  aorLink: "sip:1001@sip.local",
  city: "London",
  country: "United Kingdom",
  countryIsoCode: "GB",
  sessionAffinityHeader: null,
  extraHeaders: null,
  trunk: null,
  createdAt: now,
  updatedAt: now,
  extended: null,
  ...numbersInDb.find((number) => number.ref === ref)
})

// A Number update that the alias check rejects: nothing reaches the database
const runRejectedNumberUpdate = async (request: unknown) => {
  const operation = sandbox.stub()
  const callback = sandbox.stub()
  await update(operation, CC.Kind.NUMBER)({ request } as never, callback)
  expect(operation).to.not.have.been.called
  return callback.firstCall.args[0]
}

const runUpdate = async (
  kind: CC.KindWithoutUnknown,
  request: unknown,
  fromDb: unknown
) => {
  const operation = sandbox.stub().resolves(fromDb)
  const callback = sandbox.stub()
  await update(operation, kind)({ request } as never, callback)
  expect(callback).to.have.been.calledOnceWith(null, sinon.match.object)
  return operation.firstCall.args[0].data
}

describe("@routr/pgdata/api/update", () => {
  let egressPolicyDeleteMany: sinon.SinonStub
  let trunkURIDeleteMany: sinon.SinonStub

  beforeEach(() => {
    egressPolicyDeleteMany = sandbox.stub().resolves({ count: 1 })
    trunkURIDeleteMany = sandbox.stub().resolves({ count: 1 })
    prisma.egressPolicy.deleteMany = egressPolicyDeleteMany as never
    prisma.trunkURI.deleteMany = trunkURIDeleteMany as never
    prisma.number.findUnique = sandbox
      .stub()
      .callsFake(
        async ({ where }) =>
          numbersInDb.find((number) => number.ref === where.ref) ?? null
      ) as never
    prisma.number.findMany = sandbox
      .stub()
      .callsFake(async ({ where }) =>
        numbersInDb.filter((number) => number.trunkRef === where.trunkRef)
      ) as never
  })

  afterEach(() => {
    prisma.egressPolicy.deleteMany = originalEgressPolicyDeleteMany
    prisma.trunkURI.deleteMany = originalTrunkURIDeleteMany
    prisma.number.findUnique = originalNumberFindUnique
    prisma.number.findMany = originalNumberFindMany
    sandbox.restore()
  })

  it("updates only the name of a Domain when that is all the request sends", async () => {
    const request = decode(DOMAINS[0], DOMAINS[1], "Update", {
      ref: "domain-01",
      name: "Renamed Domain"
    })

    const data = await runUpdate(CC.Kind.DOMAIN, request, domainFromDb)

    expect(egressPolicyDeleteMany).to.not.have.been.called
    expect(data).to.deep.equal({ ref: "domain-01", name: "Renamed Domain" })
  })

  it("replaces Domain egress policies when the request sends a non-empty list", async () => {
    const request = decode(DOMAINS[0], DOMAINS[1], "Update", {
      ref: "domain-01",
      egressPolicies: [{ rule: "^1", numberRef: "number-new" }]
    })

    const data = await runUpdate(CC.Kind.DOMAIN, request, domainFromDb)

    expect(egressPolicyDeleteMany).to.have.been.calledOnceWithExactly({
      where: { domainRef: "domain-01" }
    })
    expect(data.egressPolicies.create).to.deep.equal([
      { rule: "^1", numberRef: "number-new" }
    ])
  })

  it("keeps Domain egress policies when the request sends an empty list", async () => {
    const request = decode(DOMAINS[0], DOMAINS[1], "Update", {
      ref: "domain-01",
      egressPolicies: []
    })

    const data = await runUpdate(CC.Kind.DOMAIN, request, domainFromDb)

    expect(egressPolicyDeleteMany).to.not.have.been.called
    expect(data).to.not.have.property("egressPolicies")
  })

  it("clears a Domain reference when the request sends an empty string", async () => {
    const request = decode(DOMAINS[0], DOMAINS[1], "Update", {
      ref: "domain-01",
      accessControlListRef: ""
    })

    const data = await runUpdate(CC.Kind.DOMAIN, request, domainFromDb)

    expect(data).to.deep.equal({ ref: "domain-01", accessControlListRef: null })
  })

  it("leaves the rest of a Trunk untouched on a rename", async () => {
    const request = decode(TRUNKS[0], TRUNKS[1], "Update", {
      ref: "trunk-01",
      name: "Renamed Trunk"
    })

    const data = await runUpdate(CC.Kind.TRUNK, request, trunkFromDb)

    expect(trunkURIDeleteMany).to.not.have.been.called
    expect(data).to.deep.equal({ ref: "trunk-01", name: "Renamed Trunk" })
  })

  it("applies an explicit false to a Trunk", async () => {
    const request = decode(TRUNKS[0], TRUNKS[1], "Update", {
      ref: "trunk-01",
      sendRegister: false
    })

    const data = await runUpdate(CC.Kind.TRUNK, request, trunkFromDb)

    expect(data).to.deep.equal({ ref: "trunk-01", sendRegister: false })
  })

  it("applies the caller identity settings of a Trunk", async () => {
    const request = decode(TRUNKS[0], TRUNKS[1], "Update", {
      ref: "trunk-01",
      normalizeToE164: true,
      rewriteFromWithNumber: true,
      fromDomain: "sip.example.com"
    })

    const data = await runUpdate(CC.Kind.TRUNK, request, trunkFromDb)

    expect(data).to.deep.equal({
      ref: "trunk-01",
      normalizeToE164: true,
      rewriteFromWithNumber: true,
      fromDomain: "sip.example.com"
    })
  })

  it("replaces Trunk URIs when the request sends a non-empty list", async () => {
    const request = decode(TRUNKS[0], TRUNKS[1], "Update", {
      ref: "trunk-01",
      uris: [{ host: "new.example", port: 5060 }]
    })

    const data = await runUpdate(CC.Kind.TRUNK, request, trunkFromDb)

    expect(trunkURIDeleteMany).to.have.been.calledOnceWithExactly({
      where: { trunkRef: "trunk-01" }
    })
    expect(data.uris.create).to.have.lengthOf(1)
    expect(data.uris.create[0]).to.include({ host: "new.example", port: 5060 })
  })

  it("keeps ACL rules the request does not send", async () => {
    const request = decode(ACLS[0], ACLS[1], "Update", {
      ref: "acl-01",
      allow: ["192.168.1.0/24"]
    })

    const data = await runUpdate(CC.Kind.ACL, request, aclFromDb)

    expect(data).to.deep.equal({ ref: "acl-01", allow: ["192.168.1.0/24"] })
  })

  describe("Number aliases", () => {
    it("replaces the aliases when the request sends a non-empty list", async () => {
      const request = decode(NUMBERS[0], NUMBERS[1], "Update", {
        ref: "number-01",
        aliases: ["01234", "9999"]
      })

      const data = await runUpdate(
        CC.Kind.NUMBER,
        request,
        numberFromDb("number-01")
      )

      // Its own alias again plus a new one
      expect(data).to.deep.equal({
        ref: "number-01",
        aliases: ["01234", "9999"]
      })
    })

    it("keeps the aliases when the request sends an empty list", async () => {
      const request = decode(NUMBERS[0], NUMBERS[1], "Update", {
        ref: "number-01",
        name: "Renamed",
        aliases: []
      })

      const data = await runUpdate(
        CC.Kind.NUMBER,
        request,
        numberFromDb("number-01")
      )

      expect(data).to.deep.equal({ ref: "number-01", name: "Renamed" })
      expect(prisma.number.findMany).to.not.have.been.called
    })

    it("removes every alias with clearAliases", async () => {
      const request = decode(NUMBERS[0], NUMBERS[1], "Update", {
        ref: "number-01",
        clearAliases: true
      })

      const data = await runUpdate(
        CC.Kind.NUMBER,
        request,
        numberFromDb("number-01")
      )

      expect(data).to.deep.equal({ ref: "number-01", aliases: [] })
    })

    it("rejects an alias another Number of the Trunk has", async () => {
      const request = decode(NUMBERS[0], NUMBERS[1], "Update", {
        ref: "number-02",
        aliases: ["01234"]
      })

      const error = await runRejectedNumberUpdate(request)

      expect(error).to.include({
        code: grpc.status.INVALID_ARGUMENT,
        message: taken("01234", "number-01")
      })
    })

    it("rejects a move into a Trunk where an alias is taken", async () => {
      // number-03 has 01234 on trunk-02; on trunk-01 number-01 has it
      const request = decode(NUMBERS[0], NUMBERS[1], "Update", {
        ref: "number-03",
        trunkRef: "trunk-01"
      })

      const error = await runRejectedNumberUpdate(request)

      expect(error).to.include({
        code: grpc.status.INVALID_ARGUMENT,
        message: taken("01234", "number-01")
      })
    })

    it("allows a move when the request replaces the taken alias", async () => {
      const request = decode(NUMBERS[0], NUMBERS[1], "Update", {
        ref: "number-03",
        trunkRef: "trunk-01",
        aliases: ["4321"]
      })

      const data = await runUpdate(
        CC.Kind.NUMBER,
        request,
        numberFromDb("number-03")
      )

      expect(data).to.deep.equal({
        ref: "number-03",
        trunkRef: "trunk-01",
        aliases: ["4321"]
      })
    })
  })

  it("rejects an explicit empty name", async () => {
    const request = decode(DOMAINS[0], DOMAINS[1], "Update", {
      ref: "domain-01",
      name: ""
    })
    const operation = sandbox.stub().resolves(domainFromDb)
    const callback = sandbox.stub()

    await update(operation, CC.Kind.DOMAIN)({ request } as never, callback)

    expect(operation).to.not.have.been.called
    expect(callback.firstCall.args[0]).to.be.an("error")
  })

  it("still writes every field on create", async () => {
    const request = decode(DOMAINS[0], DOMAINS[1], "Create", {
      name: "Local Domain",
      domainUri: "sip.local"
    })
    const operation = sandbox.stub().resolves(domainFromDb)
    const callback = sandbox.stub()

    await create(operation, CC.Kind.DOMAIN)({ request } as never, callback)

    expect(callback).to.have.been.calledOnceWith(null, sinon.match.object)
    const data = operation.firstCall.args[0].data
    expect(data).to.include({
      name: "Local Domain",
      domainUri: "sip.local",
      accessControlListRef: null
    })
    expect(data.egressPolicies).to.deep.equal({ create: [] })
  })
})

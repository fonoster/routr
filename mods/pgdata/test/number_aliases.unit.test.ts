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
chai.use(sinonChai)
const sandbox = sinon.createSandbox()
const originalNumberFindUnique = prisma.number.findUnique
const originalNumberFindMany = prisma.number.findMany

// The messages of the alias rules
const taken = (alias: string, ref: string) =>
  `alias "${alias}" is already used by Number ${ref} on this Trunk`
const invalid = (alias: string) =>
  `alias "${alias}" is invalid: use 1 to 60 letters, digits or + * . _ -`

const PROTOS_DIR = path.join(__dirname, "../../common/src/connect/protos")

// Round-trips a request through the real proto, so the handler sees exactly
// what the server decodes (omitted optional fields absent, lists as [])
const decode = (
  method: "Create" | "Update",
  request: Record<string, unknown>
) => {
  const definition = protoLoader.loadSync(
    path.join(PROTOS_DIR, "numbers.proto"),
    { ...protoLoadOptions, includeDirs: [PROTOS_DIR] }
  )
  const rpc = (
    definition["fonoster.routr.connect.numbers.v2beta1.Numbers"] as Record<
      string,
      protoLoader.MethodDefinition<unknown, unknown>
    >
  )[method]
  return rpc.requestDeserialize(rpc.requestSerialize(request))
}

const now = new Date()

// number-01 and number-02 share trunk-01; number-03 is alone on trunk-02
const numbersInDb = [
  { ref: "number-01", aliases: ["01234"], trunkRef: "trunk-01" },
  { ref: "number-02", aliases: ["5678"], trunkRef: "trunk-01" },
  { ref: "number-03", aliases: ["01234"], trunkRef: "trunk-02" }
]

const fromDb = (data: Record<string, unknown>): Record<string, unknown> => ({
  apiVersion: CC.APIVersion.V2,
  name: "Carrier UK main line",
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
  ...data
})

const newNumber = {
  name: "Carrier UK main line",
  telUrl: "tel:+442079460019",
  aorLink: "sip:1001@sip.local",
  city: "London",
  country: "United Kingdom",
  countryIsoCode: "GB",
  trunkRef: "trunk-01"
}

// The handler's write and answer; the write echoes what it was given
const run = async (
  method: "Create" | "Update",
  request: Record<string, unknown>
) => {
  const operation = sandbox.stub().callsFake(async ({ where, data }) =>
    fromDb({
      ...numbersInDb.find((number) => number.ref === where?.ref),
      ...data,
      ref: where?.ref ?? "number-new",
      // mapToPrisma leaves the timestamps to the database
      createdAt: now,
      updatedAt: now
    })
  )
  const callback = sandbox.stub()
  const handler = method === "Create" ? create : update
  await handler(operation, CC.Kind.NUMBER)(
    { request: decode(method, request) } as never,
    callback
  )
  const [error, number] = callback.firstCall.args
  return { operation, error, number }
}

describe("@routr/pgdata/number_aliases", () => {
  beforeEach(() => {
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
    prisma.number.findUnique = originalNumberFindUnique
    prisma.number.findMany = originalNumberFindMany
    sandbox.restore()
  })

  describe("create", () => {
    it("stores the aliases and answers with them", async () => {
      const { operation, error, number } = await run("Create", {
        ...newNumber,
        aliases: ["4321"]
      })

      expect(error).to.be.null
      expect(operation.firstCall.args[0].data.aliases).to.deep.equal(["4321"])
      expect(number.aliases).to.deep.equal(["4321"])
    })

    it("creates a Number without aliases without reading the Trunk", async () => {
      const { error, number } = await run("Create", newNumber)

      expect(error).to.be.null
      expect(number.aliases).to.deep.equal([])
      expect(prisma.number.findMany).to.not.have.been.called
    })

    it("rejects an alias another Number of the Trunk has, writing nothing", async () => {
      const { operation, error } = await run("Create", {
        ...newNumber,
        aliases: ["01234"]
      })

      expect(operation).to.not.have.been.called
      expect(error).to.include({
        code: grpc.status.INVALID_ARGUMENT,
        message: taken("01234", "number-01")
      })
    })

    it("allows an alias another Trunk uses", async () => {
      const { error } = await run("Create", {
        ...newNumber,
        trunkRef: "trunk-02",
        aliases: ["5678"]
      })

      expect(error).to.be.null
    })
  })

  describe("update", () => {
    it("replaces the aliases with a non-empty list, its own included", async () => {
      const { error, number } = await run("Update", {
        ref: "number-01",
        aliases: ["01234", "9999"]
      })

      expect(error).to.be.null
      expect(number.aliases).to.deep.equal(["01234", "9999"])
    })

    it("keeps the aliases with an empty list", async () => {
      const { operation, error, number } = await run("Update", {
        ref: "number-01",
        name: "Renamed",
        aliases: []
      })

      expect(error).to.be.null
      expect(operation.firstCall.args[0].data).to.not.have.property("aliases")
      expect(number.aliases).to.deep.equal(["01234"])
      expect(prisma.number.findMany).to.not.have.been.called
    })

    it("removes every alias with clearAliases, with or without aliases", async () => {
      const cleared = await run("Update", {
        ref: "number-01",
        clearAliases: true
      })
      const both = await run("Update", {
        ref: "number-01",
        aliases: ["9999"],
        clearAliases: true
      })

      expect(cleared.number.aliases).to.deep.equal([])
      expect(both.error).to.be.null
      expect(both.number.aliases).to.deep.equal([])
    })

    it("rejects an alias another Number of the Trunk has, writing nothing", async () => {
      const { operation, error } = await run("Update", {
        ref: "number-02",
        aliases: ["01234"]
      })

      expect(operation).to.not.have.been.called
      expect(error).to.include({
        code: grpc.status.INVALID_ARGUMENT,
        message: taken("01234", "number-01")
      })
    })

    it("checks the aliases against the Trunk the request moves the Number to", async () => {
      const { operation, error } = await run("Update", {
        ref: "number-03",
        trunkRef: "trunk-01",
        aliases: ["5678"]
      })

      expect(operation).to.not.have.been.called
      expect(error).to.include({ message: taken("5678", "number-02") })
    })
  })

  describe("an invalid alias", () => {
    const aliases = ["012 34", "012;34", "", "1".repeat(61)]

    aliases.forEach((alias) =>
      it(`rejects "${alias}" on create and update`, async () => {
        const created = await run("Create", { ...newNumber, aliases: [alias] })
        const updated = await run("Update", {
          ref: "number-01",
          aliases: [alias]
        })

        ;[created, updated].forEach(({ operation, error }) => {
          expect(operation).to.not.have.been.called
          expect(error).to.include({
            code: grpc.status.INVALID_ARGUMENT,
            message: invalid(alias)
          })
        })
      })
    )
  })
})

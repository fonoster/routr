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

const expect = chai.expect

// The messages of the alias rules
const taken = (alias: string, ref: string) =>
  `alias "${alias}" is already used by Number ${ref} on this Trunk`
const invalid = (alias: string) =>
  `alias "${alias}" is invalid: use 1 to 60 characters without spaces`
chai.use(sinonChai)
const sandbox = sinon.createSandbox()
const originalNumberFindMany = prisma.number.findMany

const PROTOS_DIR = path.join(__dirname, "../../common/src/connect/protos")

// The request as the server decodes it from the real proto
const decodeCreate = (request: Record<string, unknown>) => {
  const definition = protoLoader.loadSync(
    path.join(PROTOS_DIR, "numbers.proto"),
    { ...protoLoadOptions, includeDirs: [PROTOS_DIR] }
  )
  const rpc = (
    definition["fonoster.routr.connect.numbers.v2beta1.Numbers"] as Record<
      string,
      protoLoader.MethodDefinition<unknown, unknown>
    >
  ).Create
  return rpc.requestDeserialize(rpc.requestSerialize(request))
}

const now = new Date()

const newNumber = {
  name: "Carrier UK main line",
  telUrl: "tel:+442079460018",
  aorLink: "sip:1001@sip.local",
  city: "London",
  country: "United Kingdom",
  countryIsoCode: "GB",
  trunkRef: "trunk-01"
}

const runCreate = async (request: Record<string, unknown>) => {
  const operation = sandbox.stub().callsFake(async ({ data }) => ({
    ...data,
    ref: "number-new",
    trunk: null,
    createdAt: now,
    updatedAt: now
  }))
  const callback = sandbox.stub()
  await create(operation, CC.Kind.NUMBER)(
    { request: decodeCreate(request) } as never,
    callback
  )
  return { operation, callback }
}

describe("@routr/pgdata/api/create", () => {
  beforeEach(() => {
    // number-01 already answers to 01234 on trunk-01
    prisma.number.findMany = sandbox
      .stub()
      .callsFake(async ({ where }) =>
        where.trunkRef === "trunk-01"
          ? [{ ref: "number-01", aliases: ["01234"], trunkRef: "trunk-01" }]
          : []
      ) as never
  })

  afterEach(() => {
    prisma.number.findMany = originalNumberFindMany
    sandbox.restore()
  })

  it("stores the aliases of a new Number and returns them", async () => {
    const { operation, callback } = await runCreate({
      ...newNumber,
      aliases: ["5678"]
    })

    expect(operation.firstCall.args[0].data.aliases).to.deep.equal(["5678"])
    const [error, number] = callback.firstCall.args
    expect(error).to.be.null
    expect(number.aliases).to.deep.equal(["5678"])
  })

  it("creates a Number without aliases as before", async () => {
    const { operation, callback } = await runCreate(newNumber)

    expect(prisma.number.findMany).to.not.have.been.called
    expect(operation.firstCall.args[0].data.aliases).to.deep.equal([])
    expect(callback.firstCall.args[0]).to.be.null
  })

  it("rejects an alias another Number of the Trunk has, and writes nothing", async () => {
    const { operation, callback } = await runCreate({
      ...newNumber,
      aliases: ["01234"]
    })

    expect(operation).to.not.have.been.called
    const [error] = callback.firstCall.args
    expect(error).to.include({
      code: grpc.status.INVALID_ARGUMENT,
      message: taken("01234", "number-01")
    })
  })

  it("allows the same alias on another Trunk", async () => {
    const { operation, callback } = await runCreate({
      ...newNumber,
      trunkRef: "trunk-02",
      aliases: ["01234"]
    })

    expect(operation).to.have.been.calledOnce
    expect(callback.firstCall.args[0]).to.be.null
  })

  it("rejects an alias with a space", async () => {
    const { operation, callback } = await runCreate({
      ...newNumber,
      aliases: ["012 34"]
    })

    expect(operation).to.not.have.been.called
    expect(callback.firstCall.args[0]).to.include({
      code: grpc.status.INVALID_ARGUMENT,
      message: invalid("012 34")
    })
  })
})

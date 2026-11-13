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
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"
import { protoLoadOptions } from "../../common/src/service"
import { create } from "../src/api/create"
import { update } from "../src/api/update"
import { TrunkManager } from "../src/mappers/trunk"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

const PROTOS_DIR = path.join(__dirname, "../../common/src/connect/protos")
const TRUNKS = "fonoster.routr.connect.trunks.v2beta1.Trunks"

// The request as the server decodes it, and the Trunk as a client reads it,
// through the real proto
const rpcOf = (method: "Create" | "Update" | "Get") =>
  (
    protoLoader.loadSync(path.join(PROTOS_DIR, "trunks.proto"), {
      ...protoLoadOptions,
      includeDirs: [PROTOS_DIR]
    })[TRUNKS] as Record<string, protoLoader.MethodDefinition<unknown, unknown>>
  )[method]

const decode = (
  method: "Create" | "Update",
  request: Record<string, unknown>
) => rpcOf(method).requestDeserialize(rpcOf(method).requestSerialize(request))

const overTheWire = (trunk: unknown) =>
  rpcOf("Get").responseDeserialize(
    rpcOf("Get").responseSerialize(trunk)
  ) as CC.Trunk

const now = new Date()

const trunkFromDb = (columns: Record<string, unknown> = {}) => ({
  apiVersion: CC.APIVersion.V2,
  ref: "trunk-01",
  name: "Carrier UK",
  inboundUri: "carrier-uk.pstn.example",
  sendRegister: false,
  normalizeToE164: false,
  rewriteFromWithNumber: false,
  fromDomain: null as string | null,
  calledNumberFormat: null as string | null,
  calledNumberPrefix: null as string | null,
  callerNumberFormat: null as string | null,
  callerNumberPrefix: null as string | null,
  accessControlListRef: null as string | null,
  inboundCredentialsRef: null as string | null,
  outboundCredentialsRef: null as string | null,
  accessControlList: null as unknown,
  inboundCredentials: null as unknown,
  outboundCredentials: null as unknown,
  traceEnabled: false,
  createdAt: now,
  updatedAt: now,
  extended: null as unknown,
  uris: [] as unknown[],
  ...columns
})

const run = async (
  handler: typeof create | typeof update,
  request: unknown,
  stored = trunkFromDb()
) => {
  const operation = sandbox.stub().callsFake(async ({ data }) => ({
    ...stored,
    ...data,
    createdAt: now,
    updatedAt: now,
    uris: []
  }))
  const callback = sandbox.stub()
  await handler(operation as never, CC.Kind.TRUNK)(
    { request } as never,
    callback
  )
  return {
    data: operation.firstCall?.args[0].data,
    error: callback.firstCall.args[0],
    trunk: callback.firstCall.args[1]
  }
}

describe("@routr/pgdata number formats of a Trunk", () => {
  const { E164_WITHOUT_PLUS, NATIONAL, UNSPECIFIED } = CT.NumberFormat
  let stored = trunkFromDb()

  beforeEach(() => {
    stored = trunkFromDb()
  })

  afterEach(() => sandbox.restore())

  it("stores the formats and prefixes of a new Trunk and returns them", async () => {
    const { data, error, trunk } = await run(
      create,
      decode("Create", {
        name: "Carrier UK",
        inboundUri: "carrier-uk.pstn.example",
        calledNumberFormat: NATIONAL,
        calledNumberPrefix: "9",
        callerNumberFormat: E164_WITHOUT_PLUS
      })
    )

    expect(error).to.be.null
    expect(data).to.include({
      calledNumberFormat: "NATIONAL",
      calledNumberPrefix: "9",
      callerNumberFormat: "E164_WITHOUT_PLUS",
      callerNumberPrefix: null
    })
    expect(overTheWire(trunk)).to.include({
      calledNumberFormat: NATIONAL,
      calledNumberPrefix: "9",
      callerNumberFormat: E164_WITHOUT_PLUS,
      callerNumberPrefix: ""
    })
  })

  it("stores NULL for a Trunk created without formats", async () => {
    const { data, trunk } = await run(
      create,
      decode("Create", {
        name: "Carrier UK",
        inboundUri: "carrier-uk.pstn.example"
      })
    )

    expect(data).to.include({
      calledNumberFormat: null,
      calledNumberPrefix: null,
      callerNumberFormat: null,
      callerNumberPrefix: null
    })
    expect(overTheWire(trunk)).to.include({
      calledNumberFormat: UNSPECIFIED,
      callerNumberFormat: UNSPECIFIED
    })
  })

  it("reads an existing Trunk, whose columns are NULL, as unspecified", () => {
    const dto = overTheWire(TrunkManager.mapToDto(trunkFromDb() as never))

    expect(dto).to.include({
      calledNumberFormat: UNSPECIFIED,
      calledNumberPrefix: "",
      callerNumberFormat: UNSPECIFIED,
      callerNumberPrefix: ""
    })
  })

  it("updates one format and leaves the rest of the Trunk alone", async () => {
    const { data, error } = await run(
      update,
      decode("Update", { ref: "trunk-01", callerNumberFormat: NATIONAL })
    )

    expect(error).to.be.null
    expect(data).to.deep.equal({
      ref: "trunk-01",
      callerNumberFormat: "NATIONAL"
    })
  })

  it("resets a format to unspecified, with its prefix", async () => {
    stored = trunkFromDb({
      calledNumberFormat: "NATIONAL",
      calledNumberPrefix: "9"
    })

    const { data, error } = await run(
      update,
      decode("Update", {
        ref: "trunk-01",
        calledNumberFormat: UNSPECIFIED,
        calledNumberPrefix: ""
      }),
      stored
    )

    expect(error).to.be.null
    expect(data).to.deep.equal({
      ref: "trunk-01",
      calledNumberFormat: null,
      calledNumberPrefix: null
    })
  })

  it("rejects a prefix with a # or more than 20 characters", async () => {
    const message = "prefix may contain only digits and * (up to 20)"
    const created = await run(
      create,
      decode("Create", {
        name: "Carrier UK",
        inboundUri: "carrier-uk.pstn.example",
        calledNumberFormat: NATIONAL,
        calledNumberPrefix: "9#"
      })
    )
    const updated = await run(
      update,
      decode("Update", {
        ref: "trunk-01",
        callerNumberFormat: NATIONAL,
        callerNumberPrefix: "0".repeat(21)
      })
    )

    expect(created.data).to.be.undefined
    expect(created.error).to.include({
      code: grpc.status.INVALID_ARGUMENT,
      message
    })
    expect(updated.data).to.be.undefined
    expect(updated.error).to.include({
      code: grpc.status.INVALID_ARGUMENT,
      message
    })
  })

  it("accepts a prefix without its format, which does nothing", async () => {
    const created = await run(
      create,
      decode("Create", {
        name: "Carrier UK",
        inboundUri: "carrier-uk.pstn.example",
        calledNumberPrefix: "9"
      })
    )
    const updated = await run(
      update,
      decode("Update", { ref: "trunk-01", callerNumberPrefix: "9" })
    )

    expect(created.error).to.be.null
    expect(created.data).to.include({
      calledNumberFormat: null,
      calledNumberPrefix: "9"
    })
    expect(updated.error).to.be.null
    expect(updated.data).to.deep.equal({
      ref: "trunk-01",
      callerNumberPrefix: "9"
    })
  })
})

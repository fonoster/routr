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
import { prisma } from "../src/db"

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

const originalTrunkFindUnique = prisma.trunk.findUnique

const run = async (
  handler: typeof create | typeof update,
  request: unknown,
  stored = trunkFromDb()
) => {
  // An Update merges the request over the stored row before checking it
  prisma.trunk.findUnique = sandbox.stub().resolves(stored) as never
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

  afterEach(() => {
    sandbox.restore()
    prisma.trunk.findUnique = originalTrunkFindUnique
  })

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

  const needs = (name: string) =>
    `${name}NumberPrefix needs ${name}NumberFormat e164-without-plus, national or international`
  const characters = (name: string) =>
    `${name}NumberPrefix may contain only digits, * and # (up to 20)`
  const createWith = (fields: Record<string, unknown>) =>
    run(
      create,
      decode("Create", {
        name: "Carrier UK",
        inboundUri: "carrier-uk.pstn.example",
        ...fields
      })
    )
  const updateWith = (fields: Record<string, unknown>, columns = {}) =>
    run(
      update,
      decode("Update", { ref: "trunk-01", ...fields }),
      trunkFromDb(columns)
    )
  const rejected = (
    result: { data: unknown; error: unknown },
    message: string
  ) => {
    expect(result.data).to.be.undefined
    expect(result.error).to.include({
      code: grpc.status.INVALID_ARGUMENT,
      message
    })
  }

  ;["called", "caller"].forEach((name) =>
    describe(`${name}NumberPrefix`, () => {
      it("needs e164-without-plus, national or international", async () => {
        rejected(
          await createWith({ [`${name}NumberPrefix`]: "9" }),
          needs(name)
        )
        rejected(
          await createWith({
            [`${name}NumberFormat`]: CT.NumberFormat.E164,
            [`${name}NumberPrefix`]: "9"
          }),
          needs(name)
        )
        rejected(
          await updateWith({ [`${name}NumberPrefix`]: "9" }),
          needs(name)
        )
      })

      it("may contain only digits, * and #, up to 20", async () => {
        rejected(
          await createWith({
            [`${name}NumberFormat`]: NATIONAL,
            [`${name}NumberPrefix`]: "9a"
          }),
          characters(name)
        )
        rejected(
          await updateWith({
            [`${name}NumberFormat`]: NATIONAL,
            [`${name}NumberPrefix`]: "0".repeat(21)
          }),
          characters(name)
        )
      })

      it("accepts 9# with national, on create and update", async () => {
        const fields = {
          [`${name}NumberFormat`]: NATIONAL,
          [`${name}NumberPrefix`]: "9#"
        }
        const created = await createWith(fields)
        const updated = await updateWith(fields)

        expect(created.error).to.be.null
        expect(updated.error).to.be.null
      })

      it("is checked against the stored format on update", async () => {
        const stored = { [`${name}NumberFormat`]: "NATIONAL" }
        const updated = await updateWith(
          { [`${name}NumberPrefix`]: "9" },
          stored
        )

        expect(updated.error).to.be.null
        expect(updated.data).to.deep.equal({
          ref: "trunk-01",
          [`${name}NumberPrefix`]: "9"
        })
      })
    })
  )

  it("rejects an Update that resets the format while a prefix is stored", async () => {
    const stored = { calledNumberFormat: "NATIONAL", calledNumberPrefix: "9" }

    rejected(
      await updateWith({ calledNumberFormat: UNSPECIFIED }, stored),
      needs("called")
    )
    expect(
      (
        await updateWith(
          { calledNumberFormat: UNSPECIFIED, calledNumberPrefix: "" },
          stored
        )
      ).error
    ).to.be.null
  })

  it("stores INTERNATIONAL", async () => {
    const { data, error, trunk } = await createWith({
      calledNumberFormat: CT.NumberFormat.INTERNATIONAL,
      calledNumberPrefix: "9"
    })

    expect(error).to.be.null
    expect(data).to.include({ calledNumberFormat: "INTERNATIONAL" })
    expect(overTheWire(trunk)).to.include({
      calledNumberFormat: CT.NumberFormat.INTERNATIONAL
    })
  })
})

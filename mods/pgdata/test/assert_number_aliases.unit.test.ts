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
import chaiAsPromised from "chai-as-promised"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import { CommonErrors as CE } from "@routr/common"
import { createAssertNumberAliases } from "../src/api/assert_number_aliases"

const expect = chai.expect

// The messages of the alias rules
const taken = (alias: string, ref: string) =>
  `alias "${alias}" is already used by Number ${ref} on this Trunk`
chai.use(sinonChai)
chai.use(chaiAsPromised)

const select = { ref: true, aliases: true, trunkRef: true }

// number-01 has the alias 01234 on trunk-01; number-02 has none
const clientWith = (stored: Record<string, unknown> | null = null) => ({
  number: {
    findUnique: sinon.stub().resolves(stored),
    findMany: sinon.stub().callsFake(async ({ where }) =>
      [
        { ref: "number-01", aliases: ["01234"], trunkRef: "trunk-01" },
        { ref: "number-02", aliases: [], trunkRef: "trunk-01" },
        { ref: "number-03", aliases: ["5678"], trunkRef: "trunk-02" }
      ].filter((number) => number.trunkRef === where.trunkRef)
    )
  }
})

describe("@routr/pgdata/api/assert_number_aliases", () => {
  afterEach(() => sinon.restore())

  describe("with valid input", () => {
    it("reads the Trunk's Numbers and accepts a free alias on create", async () => {
      // Arrange
      const client = clientWith()

      // Act
      await createAssertNumberAliases(client)({
        aliases: ["9999"],
        trunkRef: "trunk-01"
      })

      // Assert
      expect(client.number.findUnique).to.not.have.been.called
      expect(client.number.findMany).to.have.been.calledOnceWithExactly({
        where: { trunkRef: "trunk-01" },
        select
      })
    })

    it("rejects an alias another Number of the Trunk has", async () => {
      const client = clientWith()

      await expect(
        createAssertNumberAliases(client)({
          aliases: ["01234"],
          trunkRef: "trunk-01"
        })
      ).to.be.rejectedWith(CE.BadRequestError, taken("01234", "number-01"))
    })

    it("accepts the same alias on another Trunk, and with no Trunk", async () => {
      const client = clientWith()

      await createAssertNumberAliases(client)({
        aliases: ["01234"],
        trunkRef: "trunk-02"
      })
      await createAssertNumberAliases(client)({
        aliases: ["01234"],
        trunkRef: ""
      })
    })

    it("merges an update over the stored Number", async () => {
      // Arrange: number-03 lives on trunk-02 with the alias 5678
      const stored = {
        ref: "number-03",
        aliases: ["5678"],
        trunkRef: "trunk-02"
      }

      // Act + Assert: its own aliases again
      await createAssertNumberAliases(clientWith(stored))({
        ref: "number-03",
        aliases: ["5678"]
      })
      // A new alias that trunk-01, where it moves in the same request, has
      await expect(
        createAssertNumberAliases(clientWith(stored))({
          ref: "number-03",
          aliases: ["01234"],
          trunkRef: "trunk-01"
        })
      ).to.be.rejectedWith(CE.BadRequestError, "number-01")
    })

    it("reads nothing when the request sends no aliases", async () => {
      const client = clientWith()

      await createAssertNumberAliases(client)({ ref: "number-01", aliases: [] })
      // A move alone isn't checked
      await createAssertNumberAliases(client)({
        ref: "number-01",
        trunkRef: "trunk-02"
      })
      await createAssertNumberAliases(client)({
        ref: "number-01",
        aliases: ["01234"],
        clearAliases: true
      })
      await createAssertNumberAliases(client)({
        aliases: [],
        trunkRef: "trunk-01"
      })

      expect(client.number.findUnique).to.not.have.been.called
      expect(client.number.findMany).to.not.have.been.called
    })

    it("leaves a Number that doesn't exist to the update", async () => {
      const client = clientWith(null)

      await createAssertNumberAliases(client)({
        ref: "number-gone",
        aliases: ["01234"]
      })

      expect(client.number.findMany).to.not.have.been.called
    })
  })

  describe("with invalid input", () => {
    it("throws ValidationError when aliases is not a list", async () => {
      // Arrange
      const client = clientWith()

      // Act + Assert
      await expect(
        createAssertNumberAliases(client)({ aliases: "01234" })
      ).to.be.rejectedWith(CE.ValidationError)
      expect(client.number.findUnique).to.not.have.been.called
      expect(client.number.findMany).to.not.have.been.called
    })
  })
})

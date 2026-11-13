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
import { CommonErrors as CE, CommonTypes as CT } from "@routr/common"
import { createAssertTrunkNumberFormat } from "../src/api/assert_trunk_number_format"

const expect = chai.expect
chai.use(sinonChai)
chai.use(chaiAsPromised)
const { NATIONAL, UNSPECIFIED } = CT.NumberFormat

const NO_FORMAT = "a number prefix needs a number format"

const nothingStored = {
  calledNumberFormat: null as string | null,
  calledNumberPrefix: null as string | null,
  callerNumberFormat: null as string | null,
  callerNumberPrefix: null as string | null
}

const clientWith = (stored: typeof nothingStored | null) => ({
  trunk: { findUnique: sinon.stub().resolves(stored) }
})

describe("@routr/pgdata/api/assert_trunk_number_format", () => {
  afterEach(() => sinon.restore())

  describe("with valid input", () => {
    it("reads nothing when the request leaves the formats alone", async () => {
      // Arrange
      const client = clientWith(nothingStored)

      // Act
      await createAssertTrunkNumberFormat(client)({ ref: "trunk-01" })

      // Assert
      expect(client.trunk.findUnique).to.not.have.been.called
    })

    it("accepts a prefix sent with its format, without a stored Trunk", async () => {
      const client = clientWith(null)

      await createAssertTrunkNumberFormat(client)({
        calledNumberFormat: NATIONAL,
        calledNumberPrefix: "9"
      })

      expect(client.trunk.findUnique).to.not.have.been.called
    })

    it("accepts a prefix when the stored Trunk has the format", async () => {
      const client = clientWith({
        ...nothingStored,
        calledNumberFormat: NATIONAL
      })

      await createAssertTrunkNumberFormat(client)({
        ref: "trunk-01",
        calledNumberPrefix: "9"
      })

      expect(client.trunk.findUnique).to.have.been.calledOnce
    })

    it("rejects a prefix when neither the request nor the Trunk has a format", async () => {
      await expect(
        createAssertTrunkNumberFormat(clientWith(nothingStored))({
          ref: "trunk-01",
          callerNumberPrefix: "9"
        })
      ).to.be.rejectedWith(CE.BadRequestError, NO_FORMAT)
    })

    it("rejects a reset of the format that leaves the stored prefix behind", async () => {
      const stored = {
        ...nothingStored,
        calledNumberFormat: NATIONAL,
        calledNumberPrefix: "9"
      }

      await expect(
        createAssertTrunkNumberFormat(clientWith(stored))({
          ref: "trunk-01",
          calledNumberFormat: UNSPECIFIED
        })
      ).to.be.rejectedWith(CE.BadRequestError, NO_FORMAT)
      // Clearing the prefix in the same request is fine
      await createAssertTrunkNumberFormat(clientWith(stored))({
        ref: "trunk-01",
        calledNumberFormat: UNSPECIFIED,
        calledNumberPrefix: ""
      })
    })
  })

  describe("with invalid input", () => {
    it("throws ValidationError for a format Routr doesn't know", async () => {
      // Arrange
      const client = clientWith(nothingStored)

      // Act + Assert
      await expect(
        createAssertTrunkNumberFormat(client)({
          ref: "trunk-01",
          calledNumberFormat: "LOCAL"
        })
      ).to.be.rejectedWith(CE.ValidationError)
      expect(client.trunk.findUnique).to.not.have.been.called
    })
  })
})

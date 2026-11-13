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
import chai from "chai"
import * as grpc from "@grpc/grpc-js"
import {
  CommonConnect as CC,
  CommonErrors as CE,
  CommonTypes as CT
} from "../src"

const expect = chai.expect
const { E164, NATIONAL, UNSPECIFIED } = CT.NumberFormat

const BAD_PREFIX = "prefix may contain only digits and * (up to 20)"

describe("@routr/common/connect/validate_trunk_number_format", () => {
  describe("with valid input", () => {
    it("accepts a prefix without its format, which does nothing", () => {
      expect(() =>
        CC.validateTrunkNumberFormat({
          calledNumberPrefix: "9",
          callerNumberFormat: UNSPECIFIED,
          callerNumberPrefix: "*31"
        })
      ).to.not.throw()
    })

    it("accepts a Trunk with no formats and no prefixes", () => {
      // Act + Assert
      expect(() => CC.validateTrunkNumberFormat({})).to.not.throw()
      expect(() =>
        CC.validateTrunkNumberFormat({
          calledNumberFormat: UNSPECIFIED,
          calledNumberPrefix: "",
          callerNumberFormat: null,
          callerNumberPrefix: null
        })
      ).to.not.throw()
    })

    it("accepts a prefix of digits and * next to its format", () => {
      expect(() =>
        CC.validateTrunkNumberFormat({
          calledNumberFormat: NATIONAL,
          calledNumberPrefix: "9",
          callerNumberFormat: E164,
          callerNumberPrefix: "*31*" + "0".repeat(16)
        })
      ).to.not.throw()
    })
  })

  describe("with a prefix that breaks a rule", () => {
    it("rejects a # and more than 20 characters", () => {
      const prefixes = ["9#", "+44", "0".repeat(21)]

      prefixes.forEach((calledNumberPrefix) =>
        expect(() =>
          CC.validateTrunkNumberFormat({
            calledNumberFormat: NATIONAL,
            calledNumberPrefix
          })
        )
          .to.throw(CE.BadRequestError, BAD_PREFIX)
          .with.property("code", grpc.status.INVALID_ARGUMENT)
      )
    })
  })

  describe("with invalid input", () => {
    it("throws ValidationError for a format Routr doesn't know", () => {
      expect(() =>
        CC.validateTrunkNumberFormat({ calledNumberFormat: "LOCAL" })
      ).to.throw(CE.ValidationError)
    })
  })
})

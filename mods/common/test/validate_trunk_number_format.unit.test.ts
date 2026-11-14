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
const { E164, E164_WITHOUT_PLUS, NATIONAL, INTERNATIONAL, UNSPECIFIED } =
  CT.NumberFormat

const characters = (name: string) =>
  `${name} may contain only digits, * and # (up to 20)`
const needs = (name: string, formatName: string) =>
  `${name} needs ${formatName} e164-without-plus, national or international`

describe("@routr/common/connect/validate_trunk_number_format", () => {
  describe("with valid input", () => {
    it("accepts a Trunk with no formats and no prefixes", () => {
      expect(() => CC.validateTrunkNumberFormat({})).to.not.throw()
      expect(() =>
        CC.validateTrunkNumberFormat({
          calledNumberFormat: UNSPECIFIED,
          calledNumberPrefix: "",
          callerNumberFormat: E164,
          callerNumberPrefix: null
        })
      ).to.not.throw()
    })

    it("accepts digits, * and # next to the formats that take a prefix", () => {
      ;[E164_WITHOUT_PLUS, NATIONAL, INTERNATIONAL].forEach((format) =>
        expect(() =>
          CC.validateTrunkNumberFormat({
            calledNumberFormat: format,
            calledNumberPrefix: "9#",
            callerNumberFormat: format,
            callerNumberPrefix: "*31*" + "0".repeat(16)
          })
        ).to.not.throw()
      )
    })
  })

  describe("with a prefix that breaks a rule", () => {
    it("rejects a prefix with no format or with e164", () => {
      ;[undefined, UNSPECIFIED, E164].forEach((format) => {
        expect(() =>
          CC.validateTrunkNumberFormat({
            calledNumberFormat: format,
            calledNumberPrefix: "9"
          })
        )
          .to.throw(
            CE.BadRequestError,
            needs("calledNumberPrefix", "calledNumberFormat")
          )
          .with.property("code", grpc.status.INVALID_ARGUMENT)
        expect(() =>
          CC.validateTrunkNumberFormat({
            callerNumberFormat: format,
            callerNumberPrefix: "9"
          })
        ).to.throw(
          CE.BadRequestError,
          needs("callerNumberPrefix", "callerNumberFormat")
        )
      })
    })

    it("rejects other characters and more than 20", () => {
      ;["9a", "+44", "0".repeat(21)].forEach((prefix) => {
        expect(() =>
          CC.validateTrunkNumberFormat({
            calledNumberFormat: NATIONAL,
            calledNumberPrefix: prefix
          })
        ).to.throw(CE.BadRequestError, characters("calledNumberPrefix"))
        expect(() =>
          CC.validateTrunkNumberFormat({
            callerNumberFormat: NATIONAL,
            callerNumberPrefix: prefix
          })
        ).to.throw(CE.BadRequestError, characters("callerNumberPrefix"))
      })
    })

    it("reports the characters first when both rules fail", () => {
      expect(() =>
        CC.validateTrunkNumberFormat({ calledNumberPrefix: "9a" })
      ).to.throw(CE.BadRequestError, characters("calledNumberPrefix"))
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

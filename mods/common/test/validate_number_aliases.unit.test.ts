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
import { CommonConnect as CC, CommonErrors as CE } from "../src"

const expect = chai.expect

// The messages of the alias rules
const taken = (alias: string, ref: string) =>
  `alias "${alias}" is already used by Number ${ref} on this Trunk`
const invalid = (alias: string) =>
  `alias "${alias}" is invalid: use 1 to 60 characters without spaces`

const onTrunk = [
  { ref: "number-01", aliases: ["01234"] },
  { ref: "number-02", aliases: [] as string[] }
]

const validate = (number: Record<string, unknown>, trunkNumbers = onTrunk) =>
  CC.validateNumberAliases({ number, trunkNumbers })

describe("@routr/common/connect/validate_number_aliases", () => {
  describe("with valid input", () => {
    it("accepts aliases no other Number of the Trunk has", () => {
      // Act + Assert
      expect(() =>
        validate({ trunkRef: "trunk-01", aliases: ["5678", "main-line"] })
      ).to.not.throw()
    })

    it("accepts a Number that keeps its own aliases", () => {
      expect(() =>
        validate({ ref: "number-01", trunkRef: "trunk-01", aliases: ["01234"] })
      ).to.not.throw()
    })

    it("accepts any alias on a Number with no Trunk", () => {
      expect(() => validate({ aliases: ["01234"] })).to.not.throw()
      expect(() =>
        validate({ trunkRef: "", aliases: ["01234"] })
      ).to.not.throw()
    })

    it("compares aliases exactly, case included", () => {
      expect(() =>
        validate({ trunkRef: "trunk-01", aliases: ["Main"] }, [
          { ref: "number-01", aliases: ["main"] }
        ])
      ).to.not.throw()
    })
  })

  describe("with an alias that breaks a rule", () => {
    it("names the alias and the Number that has it", () => {
      // Act
      const write = () =>
        validate({ ref: "number-03", trunkRef: "trunk-01", aliases: ["01234"] })

      // Assert
      expect(write)
        .to.throw(CE.BadRequestError, taken("01234", "number-01"))
        .with.property("code", grpc.status.INVALID_ARGUMENT)
    })

    it("rejects an empty alias, whitespace and more than 60 characters", () => {
      const bad = ["", "012 34", "0".repeat(61)]

      bad.forEach((alias) =>
        expect(() => validate({ trunkRef: "trunk-01", aliases: [alias] }))
          .to.throw(CE.BadRequestError, invalid(alias))
          .with.property("code", grpc.status.INVALID_ARGUMENT)
      )
      expect(() =>
        validate({ trunkRef: "trunk-01", aliases: ["0".repeat(60)] })
      ).to.not.throw()
    })
  })

  describe("with invalid input", () => {
    it("throws ValidationError when aliases is not a list", () => {
      expect(() =>
        validate({ trunkRef: "trunk-01", aliases: "01234" })
      ).to.throw(CE.ValidationError)
    })

    it("throws ValidationError when the Trunk's Numbers are missing", () => {
      expect(() =>
        CC.validateNumberAliases({ number: { aliases: ["01234"] } })
      ).to.throw(CE.ValidationError)
    })
  })
})

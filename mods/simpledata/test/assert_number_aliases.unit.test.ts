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
import { CommonConnect as CC, CommonErrors as CE } from "@routr/common"
import { assertNumberAliases } from "../src/assert_number_aliases"

const expect = chai.expect

// The messages of the alias rules
const taken = (alias: string, ref: string) =>
  `alias "${alias}" is already used by Number ${ref} on this Trunk`
const invalid = (alias: string) =>
  `alias "${alias}" is invalid: use 1 to 60 letters, digits or + * . _ -`

const numberOf = (ref: string, trunkRef: string, aliases?: unknown) =>
  ({
    apiVersion: CC.APIVersion.V2,
    kind: CC.Kind.NUMBER,
    ref,
    metadata: { name: ref },
    spec: {
      trunkRef,
      location: { telUrl: "tel:+442079460018", aliases }
    }
  } as CC.UserConfig)

describe("@routr/simpledata/assert_number_aliases", () => {
  describe("with valid input", () => {
    it("accepts the same alias on two Trunks and Numbers without aliases", () => {
      expect(() =>
        assertNumberAliases([
          numberOf("number-01", "trunk-01", ["01234"]),
          numberOf("number-02", "trunk-02", ["01234"]),
          numberOf("number-03", "trunk-01")
        ])
      ).to.not.throw()
    })

    it("names the alias two Numbers of one Trunk share", () => {
      expect(() =>
        assertNumberAliases([
          numberOf("number-01", "trunk-01", ["01234"]),
          numberOf("number-02", "trunk-01", ["5678", "01234"])
        ])
      ).to.throw(CE.BadRequestError, taken("01234", "number-02"))
    })

    it("rejects an alias with a space", () => {
      expect(() =>
        assertNumberAliases([numberOf("number-01", "trunk-01", ["012 34"])])
      ).to.throw(CE.BadRequestError, invalid("012 34"))
    })
  })

  describe("with invalid input", () => {
    it("throws ValidationError for an alias YAML read as a number", () => {
      // aliases: [1234] without quotes
      expect(() =>
        assertNumberAliases([numberOf("number-01", "trunk-01", [1234])])
      ).to.throw(CE.ValidationError, "an alias must be a string")
    })
  })
})

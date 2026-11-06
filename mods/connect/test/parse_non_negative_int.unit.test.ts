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
import { parseNonNegativeInt } from "../src/parse_non_negative_int"

const expect = chai.expect

describe("@routr/connect/parse_non_negative_int", () => {
  it("leaves an unset or empty variable undefined", () => {
    expect(parseNonNegativeInt("NONCE_MAX_AGE", undefined)).to.be.undefined
    expect(parseNonNegativeInt("NONCE_MAX_AGE", " ")).to.be.undefined
  })

  it("accepts zero and positive integers", () => {
    expect(parseNonNegativeInt("NONCE_MAX_AGE", "0")).to.equal(0)
    expect(parseNonNegativeInt("NONCE_MAX_AGE", "300")).to.equal(300)
  })

  it("rejects anything else, naming the variable and the value", () => {
    expect(() => parseNonNegativeInt("NONCE_MAX_AGE", "abc")).to.throw(
      /NONCE_MAX_AGE must be a non-negative integer, got "abc"/
    )
    expect(() => parseNonNegativeInt("NONCE_MAX_AGE", "-1")).to.throw(
      /NONCE_MAX_AGE must be a non-negative integer, got "-1"/
    )
  })
})

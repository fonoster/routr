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
import { stringToAliases } from "../src/lib/string_to_aliases"

const expect = chai.expect

describe("@routr/ctl/lib/string_to_aliases", () => {
  it("splits a comma-separated answer and trims each alias", () => {
    expect(stringToAliases("01234, 5678")).to.deep.equal(["01234", "5678"])
    expect(stringToAliases("01234, 5678 ,main-line")).to.deep.equal([
      "01234",
      "5678",
      "main-line"
    ])
  })

  it("reads an empty answer as no aliases", () => {
    expect(stringToAliases("")).to.deep.equal([])
    expect(stringToAliases(undefined)).to.deep.equal([])
    expect(stringToAliases(" , ")).to.deep.equal([])
  })
})

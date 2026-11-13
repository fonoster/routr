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
import { e164Candidates } from "../src/e164_candidates"

const expect = chai.expect

describe("@routr/processor/e164_candidates", () => {
  it("reads a number with the trunk prefix 0 with and without the 0", () => {
    expect(e164Candidates("02079460018", "GB")).to.deep.equal([
      "4402079460018",
      "442079460018"
    ])
    // Italy keeps the 0 in E.164, Germany drops it
    expect(e164Candidates("0287654321", "IT")).to.include("390287654321")
    expect(e164Candidates("0221123456", "DE")).to.include("49221123456")
  })

  it("reads a bare national number behind the calling code", () => {
    expect(e164Candidates("2079460018", "GB")).to.deep.equal(["442079460018"])
    expect(e164Candidates("4155550123", "US")).to.deep.equal(["14155550123"])
  })

  it("reads the digits after 00 as E.164", () => {
    expect(e164Candidates("00442079460018", "GB")).to.deep.equal([
      "442079460018",
      "4400442079460018",
      "440442079460018"
    ])
  })

  it("knows no international prefix but 00", () => {
    expect(e164Candidates("01114155550123", "US")).to.not.include("14155550123")
  })

  it("reads the country code in any case", () => {
    expect(e164Candidates("2079460018", "gb")).to.deep.equal(["442079460018"])
  })

  it("has no candidates for an empty or unknown country", () => {
    expect(e164Candidates("02079460018", "")).to.deep.equal([])
    expect(e164Candidates("02079460018", undefined)).to.deep.equal([])
    expect(e164Candidates("00442079460018", "ZZ")).to.deep.equal([])
  })
})

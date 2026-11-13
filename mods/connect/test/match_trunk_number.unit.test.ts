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
import { CommonConnect as CC } from "@routr/common"
import { matchTrunkNumber } from "../src/match_trunk_number"
import { NumberMatch } from "../src/types"

const expect = chai.expect

const numberOf = (telUrl: string, countryIsoCode: string): CC.INumber =>
  ({ ref: telUrl, telUrl, countryIsoCode } as CC.INumber)

const london = numberOf("tel:+442079460018", "GB")
const sanFrancisco = numberOf("tel:+14155550123", "US")

describe("@routr/connect/match_trunk_number", () => {
  it("matches the same digits without the +", () => {
    expect(
      matchTrunkNumber("442079460018", [sanFrancisco, london])
    ).to.deep.equal({ number: london, match: NumberMatch.DIGITS })
  })

  it("matches the national and international-prefix forms", () => {
    const forms = ["02079460018", "2079460018", "00442079460018"]
    forms.forEach((user) =>
      expect(matchTrunkNumber(user, [sanFrancisco, london])).to.deep.equal({
        number: london,
        match: NumberMatch.NATIONAL
      })
    )
  })

  it("reads the number without its phone-context parameter", () => {
    expect(
      matchTrunkNumber("02079460018;phone-context=+44", [london])
    ).to.deep.equal({ number: london, match: NumberMatch.NATIONAL })
  })

  it("runs digits over every Number before national", () => {
    // 14155550123 is the US Number's digits and also a national form of a
    // Number in another plan that starts with the same digits
    const overlapping = numberOf("tel:+114155550123", "US")
    expect(
      matchTrunkNumber("14155550123", [overlapping, sanFrancisco])
    ).to.deep.equal({ number: sanFrancisco, match: NumberMatch.DIGITS })
  })

  it("never matches an ending of a Number", () => {
    expect(matchTrunkNumber("79460018", [london])).to.be.undefined
  })

  it("skips national for an empty or unknown countryIsoCode", () => {
    const noCountry = numberOf("tel:+442079460018", "")
    const unknown = numberOf("tel:+442079460018", "ZZ")
    expect(matchTrunkNumber("02079460018", [noCountry, unknown])).to.be
      .undefined
    expect(matchTrunkNumber("442079460018", [noCountry])).to.have.property(
      "match",
      NumberMatch.DIGITS
    )
  })

  it("reads a lower-case countryIsoCode", () => {
    expect(
      matchTrunkNumber("02079460018", [numberOf("tel:+442079460018", "gb")])
    ).to.have.property("match", NumberMatch.NATIONAL)
  })

  it("matches an alias exactly, after the other rules", () => {
    const labelled = { ...london, aliases: ["01234", "Main"] }
    // 14155550123 is an alias here and the US Number's digits
    const overlapping = { ...london, aliases: ["14155550123"] }

    expect(matchTrunkNumber("01234", [sanFrancisco, labelled])).to.deep.equal({
      number: labelled,
      match: NumberMatch.ALIAS
    })
    expect(matchTrunkNumber("main", [labelled])).to.be.undefined
    expect(matchTrunkNumber("0123", [labelled])).to.be.undefined
    expect(
      matchTrunkNumber("14155550123", [overlapping, sanFrancisco])
    ).to.deep.equal({ number: sanFrancisco, match: NumberMatch.DIGITS })
  })

  it("finds nothing without a user or without Numbers", () => {
    expect(matchTrunkNumber(undefined, [london])).to.be.undefined
    expect(matchTrunkNumber("02079460018", [])).to.be.undefined
  })
})

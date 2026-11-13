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
import { CommonTypes as CT } from "@routr/common"
import { formatNumber } from "../src/format_number"

const expect = chai.expect
const { E164, E164_WITHOUT_PLUS, NATIONAL, UNSPECIFIED } = CT.NumberFormat

const format = (
  user: string,
  format: CT.NumberFormat,
  countryIsoCode?: string,
  prefix?: string
) => formatNumber(user, { format, countryIsoCode, prefix })

describe("@routr/processor/format_number", () => {
  it("writes a number in each format", () => {
    expect(format("+442079460018", E164, "GB")).to.deep.equal({
      user: "+442079460018",
      keepsUserPhone: true
    })
    expect(format("+442079460018", E164_WITHOUT_PLUS, "GB")).to.deep.equal({
      user: "442079460018",
      keepsUserPhone: false
    })
    expect(format("+442079460018", NATIONAL, "GB")).to.deep.equal({
      user: "02079460018",
      keepsUserPhone: false
    })
  })

  it("writes the national format of each country, trunk prefix included", () => {
    expect(format("+390287654321", NATIONAL, "IT").user).to.equal("0287654321")
    expect(format("+14155550123", NATIONAL, "US").user).to.equal("4155550123")
    expect(format("+49221123456", NATIONAL, "DE").user).to.equal("0221123456")
    expect(format("+447700900123", NATIONAL, "gb").user).to.equal("07700900123")
  })

  it("reads a user without a + as a number of the reference country first", () => {
    expect(format("07700900123", E164, "GB").user).to.equal("+447700900123")
    expect(format("2079460018", E164_WITHOUT_PLUS, "GB").user).to.equal(
      "442079460018"
    )
  })

  it("then as an international number written without its +", () => {
    // Not a possible GB number, so it is +1 415 555 0123
    expect(format("14155550123", E164, "GB").user).to.equal("+14155550123")
    expect(format("442079460018", NATIONAL, "GB").user).to.equal("02079460018")
  })

  it("puts the prefix in front of the formatted number", () => {
    expect(format("+447700900123", NATIONAL, "GB", "9").user).to.equal(
      "907700900123"
    )
    expect(
      format("+447700900123", E164_WITHOUT_PLUS, "GB", "*31").user
    ).to.equal("*31447700900123")
    expect(format("+447700900123", E164, "GB", "9").user).to.equal(
      "9+447700900123"
    )
  })

  it("sends a number of another calling code as +E.164 with no prefix under NATIONAL", () => {
    expect(format("+14155550123", NATIONAL, "GB", "9")).to.deep.equal({
      user: "+14155550123",
      keepsUserPhone: true
    })
  })

  it("sends +E.164 under NATIONAL when the reference country is empty or unknown", () => {
    expect(format("+442079460018", NATIONAL, "", "9").user).to.equal(
      "+442079460018"
    )
    expect(format("+442079460018", NATIONAL, "ZZ").user).to.equal(
      "+442079460018"
    )
    expect(format("+442079460018", NATIONAL, undefined).user).to.equal(
      "+442079460018"
    )
  })

  it("leaves alone what is not a phone number, with no prefix", () => {
    const users = ["999", "1001", "anonymous", "frontdesk", ""]

    users.forEach((user) =>
      expect(format(user, NATIONAL, "GB", "9")).to.deep.equal({
        user,
        keepsUserPhone: true
      })
    )
  })

  it("does nothing without a format", () => {
    expect(format("+442079460018", UNSPECIFIED, "GB", "9").user).to.equal(
      "+442079460018"
    )
    expect(format("+442079460018", undefined, "GB").user).to.equal(
      "+442079460018"
    )
  })
})

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

describe("@routr/common/connect/validate_country_iso_code", () => {
  it("accepts a code with a numbering plan, in any case", () => {
    ;["GB", "gb", "US", "Au"].forEach((countryIsoCode) =>
      expect(() => CC.validateCountryIsoCode({ countryIsoCode })).to.not.throw()
    )
  })

  it("rejects XX, a three-letter code and an unknown code", () => {
    ;["XX", "GBR", "ZZ", ""].forEach((countryIsoCode) =>
      expect(() => CC.validateCountryIsoCode({ countryIsoCode }))
        .to.throw(
          CE.BadRequestError,
          `countryIsoCode "${countryIsoCode}" is not a country with a numbering plan`
        )
        .with.property("code", grpc.status.INVALID_ARGUMENT)
    )
  })

  it("throws ValidationError when countryIsoCode is not a string", () => {
    expect(() => CC.validateCountryIsoCode({ countryIsoCode: 44 })).to.throw(
      CE.ValidationError
    )
  })
})

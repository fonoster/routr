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
import { numberFormatLabel } from "../src/lib/number_format_label"

const expect = chai.expect

describe("@routr/ctl/lib/number_format_label", () => {
  it("names the format and its prefix", () => {
    expect(numberFormatLabel(CT.NumberFormat.NATIONAL, "9")).to.equal(
      "National, prefix 9"
    )
    expect(numberFormatLabel(CT.NumberFormat.INTERNATIONAL)).to.equal(
      "International"
    )
  })

  it("shows a Trunk with no format as sending numbers as dialed", () => {
    expect(numberFormatLabel()).to.equal("As dialed")
    expect(numberFormatLabel(CT.NumberFormat.UNSPECIFIED)).to.equal("As dialed")
    expect(numberFormatLabel("LOCAL")).to.equal("As dialed")
  })
})

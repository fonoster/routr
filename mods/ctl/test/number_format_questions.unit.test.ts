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
import { numberFormatQuestions } from "../src/lib/number_format_questions"

const expect = chai.expect
const { UNSPECIFIED, E164, E164_WITHOUT_PLUS, NATIONAL, INTERNATIONAL } =
  CT.NumberFormat

describe("@routr/ctl/lib/number_format_questions", () => {
  it("asks for the called and the caller format, each followed by its prefix", () => {
    const questions = numberFormatQuestions()

    expect(questions.map((question) => question.message)).to.deep.equal([
      "Called number format (To, Request-URI)",
      "Called number prefix (optional: digits, * and #)",
      "Caller number format (From, P-Asserted-Identity)",
      "Caller number prefix (optional: digits, * and #)"
    ])
    expect(questions[0].choices).to.deep.equal([
      { name: "Leave as is", value: UNSPECIFIED },
      { name: "+E.164", value: CT.NumberFormat.E164 },
      { name: "E.164 without +", value: E164_WITHOUT_PLUS },
      { name: "National", value: NATIONAL },
      { name: "International", value: INTERNATIONAL }
    ])
    expect(questions[0].default).to.equal(UNSPECIFIED)
  })

  it("asks for a prefix only after a format that takes one", () => {
    const [, calledPrefix, , callerPrefix] = numberFormatQuestions()

    expect(calledPrefix.when({ calledNumberFormat: NATIONAL })).to.equal(true)
    expect(calledPrefix.when({ calledNumberFormat: INTERNATIONAL })).to.equal(
      true
    )
    expect(calledPrefix.when({ calledNumberFormat: UNSPECIFIED })).to.equal(
      false
    )
    expect(calledPrefix.when({ calledNumberFormat: E164 })).to.equal(false)
    expect(
      callerPrefix.when({ callerNumberFormat: E164_WITHOUT_PLUS })
    ).to.equal(true)
    expect(callerPrefix.when({})).to.equal(false)
  })

  it("validates each prefix against the format chosen, with the API's texts", () => {
    const [, calledPrefix, , callerPrefix] = numberFormatQuestions()

    expect(
      calledPrefix.validate("9#", { calledNumberFormat: NATIONAL })
    ).to.equal(true)
    expect(
      calledPrefix.validate("9a", { calledNumberFormat: NATIONAL })
    ).to.equal("calledNumberPrefix may contain only digits, * and # (up to 20)")
    expect(callerPrefix.validate("9", { callerNumberFormat: E164 })).to.equal(
      "callerNumberPrefix needs callerNumberFormat e164-without-plus, national or international"
    )
  })

  it("starts from the Trunk's settings on an update", () => {
    const questions = numberFormatQuestions({
      calledNumberFormat: NATIONAL,
      calledNumberPrefix: "9",
      callerNumberFormat: E164_WITHOUT_PLUS,
      callerNumberPrefix: ""
    })

    expect(questions.map((question) => question.default)).to.deep.equal([
      NATIONAL,
      "9",
      E164_WITHOUT_PLUS,
      undefined
    ])
  })
})

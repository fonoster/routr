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
import { CommonConnect as CC } from "@routr/common"
import { e164Candidates } from "@routr/processor"
import { NumberMatch } from "./types"

const digitsOf = (number: string) =>
  number.replace(/^tel:/, "").replace(/^\+/, "")

type TrunkMatch = Exclude<NumberMatch, NumberMatch.EXACT>

// Strictest first: a rule runs over every Number before the next one does
const rules: {
  match: TrunkMatch
  test: (identifier: string, number: CC.INumber) => boolean
}[] = [
  {
    match: NumberMatch.DIGITS,
    test: (identifier, number) =>
      digitsOf(identifier) === digitsOf(number.telUrl)
  },
  {
    match: NumberMatch.NATIONAL,
    test: (identifier, number) =>
      e164Candidates(identifier, number.countryIsoCode).includes(
        digitsOf(number.telUrl)
      )
  },
  {
    // Exact and case-sensitive: an alias is a label, not a number
    match: NumberMatch.ALIAS,
    test: (identifier, number) => !!number.aliases?.includes(identifier)
  }
]

/**
 * Finds, among a Trunk's Numbers, the one a carrier means by a Request-URI
 * user that is not the Number's telUrl: the same digits without the +, or the
 * Number in national or international-prefix form, read with the Number's own
 * countryIsoCode, or one of the Number's aliases. There is no partial match: a
 * short form needs an alias.
 *
 * @param {string} user - the Request-URI user as received
 * @param {CC.INumber[]} numbers - the Numbers of the Trunk the call is on
 * @return {object | undefined} the Number and the rule that found it
 */
export const matchTrunkNumber = (
  user: string,
  numbers: CC.INumber[]
): { number: CC.INumber; match: TrunkMatch } | undefined => {
  // User parameters such as ;phone-context=+44 (RFC 3966) or ;npdi are dropped
  const identifier = (user ?? "").split(";")[0]

  return rules
    .map((rule) => ({
      number: numbers.find((number) => rule.test(identifier, number)),
      match: rule.match
    }))
    .find((result) => !!result.number)
}

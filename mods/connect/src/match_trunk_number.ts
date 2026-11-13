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

// RFC 3966 section 5.1.5: the context of a local number, carried as a
// parameter of the user part (sip:02079460018;phone-context=+44@host)
const PHONE_CONTEXT = /;phone-context=[^;]*/i

const digitsOf = (number: string) =>
  number.replace(/^tel:/, "").replace(/^\+/, "")

// Strictest first: a rule runs over every Number before the next one does
const rules: {
  match: NumberMatch
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
): { number: CC.INumber; match: NumberMatch } | undefined => {
  const identifier = (user ?? "").replace(PHONE_CONTEXT, "")

  return rules
    .map((rule) => ({
      number: numbers.find((number) => rule.test(identifier, number)),
      match: rule.match
    }))
    .find((result) => !!result.number)
}

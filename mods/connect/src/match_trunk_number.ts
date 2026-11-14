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
import {
  CountryCode,
  isSupportedCountry,
  parsePhoneNumberFromString
} from "libphonenumber-js"
import { NumberMatch } from "./types"

const digitsOf = (number: string) =>
  number.replace(/^tel:/, "").replace(/^\+/, "")

type TrunkMatch = Exclude<NumberMatch, NumberMatch.EXACT>

/**
 * What one step of the ladder found: one Number and how, or every Number it
 * found when there is more than one.
 */
export type TrunkNumberMatch =
  | { number: CC.INumber; match: TrunkMatch }
  | { ambiguous: CC.INumber[] }

// The Numbers a step finds, each once
const distinct = (found: { number: CC.INumber; match: TrunkMatch }[]) =>
  found.filter(
    (one, index) =>
      found.findIndex((other) => other.number.ref === one.number.ref) === index
  )

const resultOf = (
  found: { number: CC.INumber; match: TrunkMatch }[]
): TrunkNumberMatch | undefined => {
  const numbers = distinct(found)
  if (numbers.length === 0) return undefined
  if (numbers.length === 1) return numbers[0]
  return { ambiguous: numbers.map((one) => one.number) }
}

const regionOf = (number: CC.INumber): CountryCode | undefined => {
  const region = number.countryIsoCode?.toUpperCase()
  return region && isSupportedCountry(region) ? region : undefined
}

const digits = (identifier: string, numbers: CC.INumber[]) =>
  numbers
    .filter((number) => digitsOf(identifier) === digitsOf(number.telUrl))
    .map((number) => ({ number, match: NumberMatch.DIGITS as TrunkMatch }))

// The user is read once with each country of the Trunk's Numbers, and counts
// only for a Number of that country. A number written after an international
// prefix (00 from GB, 011 from the US, 0011 from AU) is "international"
const nationalOrInternational = (identifier: string, numbers: CC.INumber[]) =>
  Array.from(new Set(numbers.map(regionOf).filter(Boolean)))
    .sort()
    .flatMap((region) => {
      const parsed = parsePhoneNumberFromString(identifier, region)

      if (!parsed) return []

      // Not in the library's types; a unit test fails if a bump removes it
      const source = (
        parsed as unknown as { __countryCallingCodeSource?: string }
      ).__countryCallingCodeSource
      const match =
        source === "FROM_NUMBER_WITH_IDD"
          ? NumberMatch.INTERNATIONAL
          : NumberMatch.NATIONAL

      return numbers
        .filter(
          (number) =>
            regionOf(number) === region &&
            digitsOf(number.telUrl) === digitsOf(parsed.number)
        )
        .map((number) => ({ number, match: match as TrunkMatch }))
    })

// Exact and case-sensitive: an alias is a label, not a number
const alias = (identifier: string, numbers: CC.INumber[]) =>
  numbers
    .filter((number) => !!number.aliases?.includes(identifier))
    .map((number) => ({ number, match: NumberMatch.ALIAS as TrunkMatch }))

/**
 * Finds, among a Trunk's Numbers, the one a carrier means by a Request-URI
 * user that is not the Number's telUrl, strictest step first: the same digits
 * without the +; the Number in national form or after its country's
 * international prefix, read with the Number's own countryIsoCode; one of the
 * Number's aliases. Each step looks at every Number; a step that finds two
 * ends the ladder, ambiguous. There is no partial match: a short form needs an
 * alias.
 *
 * @param {string} user - the Request-URI user as received
 * @param {CC.INumber[]} numbers - the Numbers of the Trunk the call is on
 * @return {TrunkNumberMatch | undefined} the Number and the step that found
 * it, the Numbers of an ambiguous step, or undefined when no step finds one
 */
export const matchTrunkNumber = (
  user: string,
  numbers: CC.INumber[]
): TrunkNumberMatch | undefined => {
  // User parameters such as ;phone-context=+44 (RFC 3966) or ;npdi are dropped
  const identifier = (user ?? "").split(";")[0]

  if (!identifier) return undefined

  return [digits, nationalOrInternational, alias].reduce<
    TrunkNumberMatch | undefined
  >((found, step) => found ?? resultOf(step(identifier, numbers)), undefined)
}

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
import { countryPhoneData } from "phone"

// The international prefix of ITU-T E.164, as carriers forward it
const INTERNATIONAL_PREFIX = "00"

const callingCodeOf = (countryIsoCode?: string): string | undefined =>
  countryPhoneData.find(
    (country) => country.alpha2 === countryIsoCode?.toUpperCase()
  )?.country_code

/**
 * The E.164 numbers, as digits without the +, that a number written in national
 * form may stand for in a country. A carrier writes one number several ways:
 * behind an international prefix (00442079460018), with the trunk prefix 0
 * (02079460018) or bare (2079460018). Each reading is a candidate; the caller
 * compares them with the numbers it knows, so nothing here judges whether a
 * candidate is a valid number (number plans reject real landlines).
 *
 * @param {string} identifier - the number as received, digits only
 * @param {string} countryIsoCode - ISO 3166-1 alpha-2 code of the country, any case
 * @return {string[]} the candidates; empty when the country is empty or unknown
 */
export const e164Candidates = (
  identifier: string,
  countryIsoCode?: string
): string[] => {
  const callingCode = callingCodeOf(countryIsoCode)

  if (!callingCode) return []

  const afterInternationalPrefix = identifier.startsWith(INTERNATIONAL_PREFIX)
    ? [identifier.slice(INTERNATIONAL_PREFIX.length)]
    : []

  // Italy keeps the 0 in its E.164 numbers and Germany drops it, so both
  // readings are candidates
  const national = identifier.startsWith("0")
    ? [identifier, identifier.slice(1)]
    : [identifier]

  return [
    ...afterInternationalPrefix,
    ...national.map((digits) => callingCode + digits)
  ]
}

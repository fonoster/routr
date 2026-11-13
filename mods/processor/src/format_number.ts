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
import { CommonTypes as CT } from "@routr/common"
import {
  CountryCode,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  PhoneNumber
} from "libphonenumber-js"

export interface FormatNumberOptions extends CT.NumberFormatSetting {
  // ISO 3166-1 alpha-2 country of the Number the call leaves from, any case
  countryIsoCode?: string
}

export interface FormattedNumber {
  // The user to send
  user: string
  // False once the number is written in a form that is not +E.164, where
  // ";user=phone" must not be sent with it
  keepsUserPhone: boolean
}

const countryOf = (countryIsoCode?: string): CountryCode | undefined => {
  const country = countryIsoCode?.toUpperCase()
  return country && isSupportedCountry(country) ? country : undefined
}

// A user is read as a number of the reference country first (a + makes it
// international), then as an international number written without its +.
// Whatever neither reading accepts is not a phone number: an Agent's
// username, "anonymous", a short code such as 999
const read = (user: string, country?: CountryCode): PhoneNumber | undefined =>
  [
    parsePhoneNumberFromString(user, country),
    parsePhoneNumberFromString(`+${user}`)
  ].find((number) => number?.isPossible())

/**
 * Writes a phone number the way a Trunk's carrier asks for it.
 *
 *   E164               +442079460018
 *   E164_WITHOUT_PLUS  442079460018
 *   NATIONAL           02079460018: the digits of the national format, trunk
 *                      prefix included where the country uses one, for a
 *                      number of the reference country. A number of another
 *                      calling code, or any number when the reference country
 *                      is empty or unknown, is written +E.164 with no prefix
 *
 * The prefix goes in front of the formatted number. A user that is not a
 * phone number is returned as it is, with no prefix.
 *
 * @param {string} user - the user part of a URI, as routed
 * @param {FormatNumberOptions} options - the format, the prefix and the
 * country of the Number the call leaves from
 * @return {FormattedNumber} the user to send and whether ";user=phone" still
 * describes it
 */
export const formatNumber = (
  user: string,
  options: FormatNumberOptions
): FormattedNumber => {
  const { format, prefix = "" } = options
  const country = countryOf(options.countryIsoCode)
  const untouched = { user, keepsUserPhone: true }

  if (!user || !format || format === CT.NumberFormat.UNSPECIFIED) {
    return untouched
  }

  const number = read(user, country)

  if (!number) return untouched

  if (format === CT.NumberFormat.E164) {
    return { user: prefix + number.number, keepsUserPhone: true }
  }

  if (format === CT.NumberFormat.E164_WITHOUT_PLUS) {
    return { user: prefix + number.number.slice(1), keepsUserPhone: false }
  }

  // NATIONAL means something only inside the reference country's own plan
  if (
    !country ||
    getCountryCallingCode(country) !== number.countryCallingCode
  ) {
    return { user: number.number, keepsUserPhone: true }
  }

  return {
    user: prefix + number.formatNational().replace(/\D/g, ""),
    keepsUserPhone: false
  }
}

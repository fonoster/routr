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
  // True when the user sent starts with + or was left as it was: only then
  // may ";user=phone" stay on its URI
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

// The international prefix of a country, digits only, as libphonenumber-js
// writes it from there toward a number of another country code: 00 from GB,
// 011 from the US, 0011 from AU. format("IDD") writes a number of the same
// country in national form, so the probe is always of another country, and
// its own country code and national number are dropped from the end. Empty
// when the country has no single international prefix (BR, KR...).
const internationalPrefix = (country: CountryCode): string => {
  const probe = parsePhoneNumberFromString(
    getCountryCallingCode(country) === "44" ? "+12015550123" : "+442079460000"
  )
  const written = probe.format("IDD", { fromCountry: country })
  const tail = probe.countryCallingCode + probe.nationalNumber
  const digits = written?.replace(/\D/g, "") ?? ""

  if (!written || written.startsWith("+") || !digits.endsWith(tail)) return ""

  return digits.slice(0, -tail.length)
}

/**
 * Writes a phone number the way a Trunk's carrier asks for it.
 *
 *   E164               +442079460018, with no prefix
 *   E164_WITHOUT_PLUS  442079460018
 *   NATIONAL           02079460018: the digits of the national format, trunk
 *                      prefix included where the country uses one, for a
 *                      number of the reference country; a number of another
 *                      calling code in international form
 *   INTERNATIONAL      00442079460018: the international prefix of the
 *                      reference country, the country code and the national
 *                      number
 *
 * NATIONAL and INTERNATIONAL write +E.164 with no prefix when the reference
 * country is empty, unknown or has no single international prefix. The
 * prefix goes in front of the formatted number, with # escaped as %23 (RFC
 * 3261 section 25.1). A user that is not a phone number is returned as it is,
 * with no prefix.
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
  const { format } = options
  const prefix = (options.prefix ?? "").replace(/#/g, "%23")
  const country = countryOf(options.countryIsoCode)
  const untouched = { user, keepsUserPhone: true }

  if (!user || !format || format === CT.NumberFormat.UNSPECIFIED) {
    return untouched
  }

  const number = read(user, country)

  if (!number) return untouched

  const written = (user: string) => ({
    user,
    keepsUserPhone: user.startsWith("+")
  })

  const international = () => {
    const idd = country ? internationalPrefix(country) : ""

    if (!idd) return written(number.number)

    return written(
      prefix + idd + number.countryCallingCode + number.nationalNumber
    )
  }

  switch (format) {
    case CT.NumberFormat.E164:
      return written(number.number)
    case CT.NumberFormat.E164_WITHOUT_PLUS:
      return written(prefix + number.number.slice(1))
    case CT.NumberFormat.NATIONAL:
      // NATIONAL means something only inside the reference country's own plan
      if (
        !country ||
        getCountryCallingCode(country) !== number.countryCallingCode
      ) {
        return international()
      }
      return written(prefix + number.formatNational().replace(/\D/g, ""))
    case CT.NumberFormat.INTERNATIONAL:
      return international()
    default:
      return untouched
  }
}

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
import { isSupportedCountry } from "libphonenumber-js"
import { BadRequestError } from "../errors"
import { ValidationError } from "../validation_error"
import { validateCountryIsoCodeSchema } from "./country_iso_code_schema"

/**
 * Checks the countryIsoCode of a Number created through the API: an ISO
 * 3166-1 alpha-2 code, any case, of a country libphonenumber-js has a
 * numbering plan for. Connect reads the Number's national and international
 * forms with it.
 *
 * @param {ValidateCountryIsoCodeInput} params - the countryIsoCode
 * @throws {ValidationError} when params has the wrong shape
 * @throws {BadRequestError} (INVALID_ARGUMENT) when no numbering plan has the code
 */
export function validateCountryIsoCode(params: unknown): void {
  const parsed = validateCountryIsoCodeSchema.safeParse(params)

  if (!parsed.success) throw new ValidationError(parsed.error)

  const { countryIsoCode } = parsed.data

  if (!isSupportedCountry(countryIsoCode.toUpperCase())) {
    throw new BadRequestError(
      `countryIsoCode "${countryIsoCode}" is not a country with a numbering plan`
    )
  }
}

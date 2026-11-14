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
import { BadRequestError } from "../errors"
import { ValidationError } from "../validation_error"
import { validateTelUrlSchema } from "./tel_url_schema"

// tel:+ then 2 to 15 digits, the first not 0 (ITU-T E.164)
const E164_TEL_URL = /^tel:\+[1-9][0-9]{1,14}$/

/**
 * Checks the telUrl of a new Number. With requireE164 (REQUIRE_E164_NUMBERS)
 * it must be tel:+ followed by an E.164 number; without it, it only has to
 * start with tel:. A telUrl can't be updated, so only a create checks it.
 *
 * @param {ValidateTelUrlInput} params - the telUrl and whether it must be E.164
 * @throws {ValidationError} when params has the wrong shape
 * @throws {BadRequestError} (INVALID_ARGUMENT) when the telUrl breaks the rule
 */
export function validateTelUrl(params: unknown): void {
  const parsed = validateTelUrlSchema.safeParse(params)

  if (!parsed.success) throw new ValidationError(parsed.error)

  const { telUrl, requireE164 } = parsed.data

  if (!requireE164) {
    if (!telUrl.startsWith("tel:")) {
      throw new BadRequestError("the telUrl must start with `tel:`")
    }
    return
  }

  if (!E164_TEL_URL.test(telUrl)) {
    throw new BadRequestError(
      `telUrl "${telUrl}" is not E.164: use tel:+ followed by 2 to 15 digits, the first not 0; or set REQUIRE_E164_NUMBERS=false`
    )
  }
}

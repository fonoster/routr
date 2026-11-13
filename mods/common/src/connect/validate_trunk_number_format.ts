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
import { trunkNumberFormatSchema } from "./trunk_number_format_schema"

// What a carrier's tech prefix is made of
const PREFIX = /^[0-9*]{0,20}$/

/**
 * Checks the number format settings of a request that creates or updates a
 * Trunk: a prefix holds only digits and *, up to 20. A prefix stored without
 * its format does nothing, so it needs no format to be valid.
 *
 * @param {TrunkNumberFormatInput} params - the Trunk's calledNumberFormat,
 * calledNumberPrefix, callerNumberFormat and callerNumberPrefix
 * @throws {ValidationError} when params has the wrong shape
 * @throws {BadRequestError} (INVALID_ARGUMENT) when a prefix breaks a rule
 */
export function validateTrunkNumberFormat(params: unknown): void {
  const parsed = trunkNumberFormatSchema.safeParse(params)

  if (!parsed.success) throw new ValidationError(parsed.error)

  const { calledNumberPrefix, callerNumberPrefix } = parsed.data

  ;[calledNumberPrefix, callerNumberPrefix].forEach((prefix) => {
    if (prefix && !PREFIX.test(prefix)) {
      throw new BadRequestError(
        "prefix may contain only digits and * (up to 20)"
      )
    }
  })
}

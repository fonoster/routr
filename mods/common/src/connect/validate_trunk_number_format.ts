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
import { NumberFormat } from "../types"
import { ValidationError } from "../validation_error"
import { trunkNumberFormatSchema } from "./trunk_number_format_schema"

// What a carrier's tech prefix is made of
const PREFIX = /^[0-9*]{0,20}$/

const isSet = (format?: NumberFormat | null) =>
  !!format && format !== NumberFormat.UNSPECIFIED

/**
 * Checks the number format settings a Trunk is about to be stored with: a
 * prefix holds only digits and *, up to 20, and goes with a format, since it
 * is added to the formatted number. pgdata and simpledata both call this, so
 * the rules and the messages are the same in both.
 *
 * @param {TrunkNumberFormatInput} params - the Trunk's calledNumberFormat,
 * calledNumberPrefix, callerNumberFormat and callerNumberPrefix
 * @throws {ValidationError} when params has the wrong shape
 * @throws {BadRequestError} (INVALID_ARGUMENT) when a prefix breaks a rule
 */
export function validateTrunkNumberFormat(params: unknown): void {
  const parsed = trunkNumberFormatSchema.safeParse(params)

  if (!parsed.success) throw new ValidationError(parsed.error)

  const settings = parsed.data
  const parties = [
    {
      format: settings.calledNumberFormat,
      prefix: settings.calledNumberPrefix
    },
    { format: settings.callerNumberFormat, prefix: settings.callerNumberPrefix }
  ]

  parties.forEach(({ format, prefix }) => {
    if (!prefix) return

    if (!PREFIX.test(prefix)) {
      throw new BadRequestError(
        "prefix may contain only digits and * (up to 20)"
      )
    }

    if (!isSet(format)) {
      throw new BadRequestError("a number prefix needs a number format")
    }
  })
}

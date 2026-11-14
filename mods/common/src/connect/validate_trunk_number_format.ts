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
const PREFIX = /^[0-9*#]{1,20}$/

// The formats a prefix goes in front of: E164 starts with + and takes none
const FORMATS_WITH_PREFIX = [
  NumberFormat.E164_WITHOUT_PLUS,
  NumberFormat.NATIONAL,
  NumberFormat.INTERNATIONAL
]

const checkPrefix = (
  name: string,
  formatName: string,
  prefix?: string | null,
  format?: NumberFormat | null
) => {
  if (!prefix) return

  if (!PREFIX.test(prefix)) {
    throw new BadRequestError(
      `${name} may contain only digits, * and # (up to 20)`
    )
  }

  if (!format || !FORMATS_WITH_PREFIX.includes(format)) {
    throw new BadRequestError(
      `${name} needs ${formatName} e164-without-plus, national or international`
    )
  }
}

/**
 * Checks the number format settings of a Trunk as it will be stored: a prefix
 * holds 1 to 20 digits, * and #, and goes only with the format
 * e164-without-plus, national or international. An empty prefix is no prefix.
 * The API Server, simpledata and rctl all call this, so the rules and the
 * messages are the same everywhere.
 *
 * @param {TrunkNumberFormatInput} params - the Trunk's calledNumberFormat,
 * calledNumberPrefix, callerNumberFormat and callerNumberPrefix
 * @throws {ValidationError} when params has the wrong shape
 * @throws {BadRequestError} (INVALID_ARGUMENT) when a prefix breaks a rule
 */
export function validateTrunkNumberFormat(params: unknown): void {
  const parsed = trunkNumberFormatSchema.safeParse(params)

  if (!parsed.success) throw new ValidationError(parsed.error)

  const {
    calledNumberFormat,
    calledNumberPrefix,
    callerNumberFormat,
    callerNumberPrefix
  } = parsed.data

  checkPrefix(
    "calledNumberPrefix",
    "calledNumberFormat",
    calledNumberPrefix,
    calledNumberFormat
  )
  checkPrefix(
    "callerNumberPrefix",
    "callerNumberFormat",
    callerNumberPrefix,
    callerNumberFormat
  )
}

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
import { NumberFormat } from "../types"
import { BadRequestError } from "../errors"
import { ValidationError } from "../validation_error"
import { trunkNumberFormatSchema } from "./trunk_number_format_schema"

// What a carrier's tech prefix is made of
const PREFIX = /^[0-9*#]{1,20}$/

// The formats a prefix can go in front of: a + must stay first
const TAKES_PREFIX = [
  NumberFormat.E164_WITHOUT_PLUS,
  NumberFormat.NATIONAL,
  NumberFormat.INTERNATIONAL
]

/**
 * Checks the number formats of a Trunk as it would be stored: a prefix needs
 * e164-without-plus, national or international, and may contain only digits,
 * * and #, up to 20. An empty prefix is no prefix.
 *
 * @param {unknown} params - calledNumberFormat, calledNumberPrefix, callerNumberFormat, callerNumberPrefix
 * @throws {ValidationError} when a field has the wrong type
 * @throws {BadRequestError} when a prefix breaks a rule
 */
export function validateTrunkNumberFormat(params: unknown): void {
  const parsed = trunkNumberFormatSchema.safeParse(params)

  if (!parsed.success) throw new ValidationError(parsed.error)

  const sides = [
    {
      name: "called",
      format: parsed.data.calledNumberFormat,
      prefix: parsed.data.calledNumberPrefix
    },
    {
      name: "caller",
      format: parsed.data.callerNumberFormat,
      prefix: parsed.data.callerNumberPrefix
    }
  ]

  sides.forEach(({ name, format, prefix }) => {
    if (!prefix) return

    if (!PREFIX.test(prefix)) {
      throw new BadRequestError(
        `${name}NumberPrefix may contain only digits, * and # (up to 20)`
      )
    }

    if (!TAKES_PREFIX.includes(format)) {
      throw new BadRequestError(
        `${name}NumberPrefix needs ${name}NumberFormat e164-without-plus, national or international`
      )
    }
  })
}

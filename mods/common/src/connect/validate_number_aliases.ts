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
import { validateNumberAliasesSchema } from "./number_aliases_schema"

// 1 to 60 characters, none of them whitespace
const ALIAS = /^\S{1,60}$/

/**
 * Checks the aliases a Number is about to be stored with: each is 1 to 60
 * characters without whitespace, and none belongs to another Number of the
 * same Trunk. Aliases are matched only on the Number's own Trunk, so a Number
 * with no Trunk can't collide. pgdata and simpledata both call this, so the
 * rules and the messages are the same in both.
 *
 * @param {ValidateNumberAliasesInput} params - the check to make
 * @param {object} params.number - the Number as it will be stored: its ref
 * (absent on create), Trunk and aliases
 * @param {object[]} params.trunkNumbers - the Numbers of that Trunk today
 * @throws {ValidationError} when params has the wrong shape
 * @throws {BadRequestError} (INVALID_ARGUMENT) naming the alias that breaks a rule
 */
export function validateNumberAliases(params: unknown): void {
  const parsed = validateNumberAliasesSchema.safeParse(params)

  if (!parsed.success) throw new ValidationError(parsed.error)

  const { number, trunkNumbers } = parsed.data

  const invalid = number.aliases.find((alias) => !ALIAS.test(alias))

  if (invalid !== undefined) {
    throw new BadRequestError(
      `alias "${invalid}" is invalid: use 1 to 60 characters without spaces`
    )
  }

  if (!number.trunkRef) return

  const others = trunkNumbers.filter((other) => other.ref !== number.ref)

  number.aliases.forEach((alias) => {
    const owner = others.find((other) => other.aliases?.includes(alias))

    if (owner) {
      throw new BadRequestError(
        `alias "${alias}" is already used by Number ${owner.ref} on this Trunk`
      )
    }
  })
}

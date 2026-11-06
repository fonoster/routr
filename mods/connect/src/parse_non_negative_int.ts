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
/**
 * Parses an optional environment variable that must hold a non-negative
 * integer, such as NONCE_MAX_AGE, where 0 is a valid setting.
 *
 * @param {string} name - The variable name, used in the error message
 * @param {string} value - The raw value
 * @return {number | undefined} the parsed value, or undefined when unset
 * @throws {Error} when the value isn't a non-negative integer
 */
export function parseNonNegativeInt(
  name: string,
  value?: string
): number | undefined {
  if (value === undefined || value.trim() === "") return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer, got "${value}"`)
  }
  return parsed
}

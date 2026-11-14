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
 * Parses an optional environment variable that must hold true or false, such
 * as REQUIRE_E164_NUMBERS. Unset or empty is false.
 *
 * @param {string} name - The variable name, used in the error message
 * @param {string} value - The raw value
 * @return {boolean} the parsed value
 * @throws {Error} when the value is neither true nor false
 */
export function parseBooleanEnv(name: string, value?: string): boolean {
  if (value === undefined || value === "" || value === "false") return false
  if (value === "true") return true
  throw new Error(`${name} must be true or false, got "${value}"`)
}

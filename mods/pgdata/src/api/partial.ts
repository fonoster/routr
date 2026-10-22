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
/* eslint-disable require-jsdoc */
type Fields = Record<string, unknown>

// The proto loader adds a synthetic oneof marker (e.g. `_name: "name"`) for
// every proto3 optional field that is set
export function stripPresenceMarkers<T extends Fields>(request: T): T {
  return Object.fromEntries(
    Object.entries(request).filter(
      ([key, value]) => !(key.startsWith("_") && value === key.slice(1))
    )
  ) as T
}

// Update requests are partial. Optional fields are absent unless sent, while
// repeated fields and messages always decode ([] and null), so an empty list
// or a null message means "keep what is stored"
export function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false
  return Array.isArray(value) ? value.length > 0 : true
}

// Keeps only the entries of the mapped data whose field the request carried
export function pickPresentFields<T extends Fields>(
  request: Fields,
  data: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => isPresent(request[key]))
  ) as Partial<T>
}

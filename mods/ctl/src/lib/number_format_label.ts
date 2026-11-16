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
import { CommonTypes as CT } from "@routr/common"

const LABELS: Record<string, string> = {
  [CT.NumberFormat.E164]: "+E.164",
  [CT.NumberFormat.E164_WITHOUT_PLUS]: "E.164 without +",
  [CT.NumberFormat.NATIONAL]: "National",
  [CT.NumberFormat.INTERNATIONAL]: "International"
}

/**
 * How rctl shows a Trunk's number format and its prefix.
 *
 * @param {CT.NumberFormat} format - The format, unset when the Trunk sends numbers as dialed
 * @param {string} prefix - What goes before the formatted number
 * @return {string} For example "National, prefix 9"
 */
export function numberFormatLabel(
  format?: CT.NumberFormat | string,
  prefix?: string
): string {
  const label = format ? LABELS[format] : undefined
  if (!label) return "As dialed"
  return prefix ? `${label}, prefix ${prefix}` : label
}

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
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"

const settingOf = (
  format?: CT.NumberFormat,
  prefix?: string
): CT.NumberFormatSetting | undefined =>
  format && format !== CT.NumberFormat.UNSPECIFIED
    ? { format, ...(prefix ? { prefix } : {}) }
    : undefined

/**
 * The number formats of the Trunk a call leaves through, in the form the
 * tailor applies them (Route.numberFormat). The country is that of the Number
 * the call leaves from: a number without a + is read as one of that country,
 * and NATIONAL writes that country's numbers in national form.
 *
 * @param {CC.Trunk} trunk - the Trunk the call leaves through
 * @param {CC.INumber} number - the Number the call is placed from
 * @return {object | undefined} the setting; undefined when the Trunk sets no format
 */
export const numberFormatOf = (
  trunk: CC.Trunk,
  number: CC.INumber
): CT.Route["numberFormat"] | undefined => {
  const called = settingOf(trunk.calledNumberFormat, trunk.calledNumberPrefix)
  const caller = settingOf(trunk.callerNumberFormat, trunk.callerNumberPrefix)

  if (!called && !caller) return undefined

  return {
    countryIsoCode: number.countryIsoCode,
    ...(called ? { called } : {}),
    ...(caller ? { caller } : {})
  }
}

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
import { numberPrefixValidator } from "../validators"

const { UNSPECIFIED, E164, E164_WITHOUT_PLUS, NATIONAL } = CT.NumberFormat

const choices = [
  { name: "Leave as is", value: UNSPECIFIED },
  { name: "+E.164", value: E164 },
  { name: "E.164 without +", value: E164_WITHOUT_PLUS },
  { name: "National", value: NATIONAL }
]

const isSet = (format?: CT.NumberFormat) => !!format && format !== UNSPECIFIED

/**
 * The prompts of "rctl trunks create" and "update" for how a Trunk's carrier
 * wants numbers written: a format for the called and the caller number, each
 * followed by its prefix when a format is chosen.
 *
 * @param {CC.Trunk} current - the Trunk being updated; its settings are the defaults
 * @return {object[]} the inquirer questions
 */
export function numberFormatQuestions(current?: Partial<CC.Trunk>) {
  return [
    {
      name: "calledNumberFormat",
      message: "Called number format (To, Request-URI)",
      type: "list",
      choices,
      default: current?.calledNumberFormat ?? UNSPECIFIED
    },
    {
      name: "calledNumberPrefix",
      message: "Called number prefix (optional, digits and *)",
      type: "input",
      default: current?.calledNumberPrefix || undefined,
      when: (answers: { calledNumberFormat?: CT.NumberFormat }) =>
        isSet(answers.calledNumberFormat),
      validate: numberPrefixValidator
    },
    {
      name: "callerNumberFormat",
      message: "Caller number format (From, P-Asserted-Identity)",
      type: "list",
      choices,
      default: current?.callerNumberFormat ?? UNSPECIFIED
    },
    {
      name: "callerNumberPrefix",
      message: "Caller number prefix (optional, digits and *)",
      type: "input",
      default: current?.callerNumberPrefix || undefined,
      when: (answers: { callerNumberFormat?: CT.NumberFormat }) =>
        isSet(answers.callerNumberFormat),
      validate: numberPrefixValidator
    }
  ]
}

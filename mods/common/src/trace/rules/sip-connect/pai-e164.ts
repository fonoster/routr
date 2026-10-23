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
import { defineRule } from "../types"
import { Profile, Severity } from "../../types"
import { headerValues, isE164, outbound, uriOf } from "../facts"
import { towardServiceProvider } from "./scope"

export default defineRule(
  {
    id: "sip-connect/pai-e164",
    profile: Profile.SIP_CONNECT,
    severity: Severity.ERROR,
    spec: "SIPconnect 1.1, calling party identity, E.164 with user=phone (test 1.3.1)",
    summary: "P-Asserted-Identity is a global E.164 number with user=phone"
  },
  ({ record }, fail) => {
    if (!towardServiceProvider(record)) return
    const pai = headerValues(outbound(record), "P-Asserted-Identity")[0]
    if (!pai) return
    const uri = uriOf(pai)
    if (!uri || !isE164(uri.user)) {
      return fail(
        `P-Asserted-Identity is not E.164: ${pai}`,
        "out",
        "P-Asserted-Identity"
      )
    }
    if (!/user=phone/.test(uri.params)) {
      return fail(
        `P-Asserted-Identity lacks user=phone: ${pai}`,
        "out",
        "P-Asserted-Identity"
      )
    }
  }
)

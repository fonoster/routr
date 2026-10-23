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
import { headerValues, outbound } from "../facts"
import { towardServiceProvider } from "./scope"

export default defineRule(
  {
    id: "sip-connect/pai-single",
    profile: Profile.SIP_CONNECT,
    severity: Severity.ERROR,
    spec: "SIPconnect 1.1, calling party identity (test 1.3.1)",
    summary: "Exactly one P-Asserted-Identity reaches the service provider"
  },
  ({ record }, fail) => {
    if (!towardServiceProvider(record)) return
    const pai = headerValues(outbound(record), "P-Asserted-Identity")
    if (pai.length === 0) {
      return fail(
        "no P-Asserted-Identity on the INVITE to the service provider",
        "out",
        "P-Asserted-Identity"
      )
    }
    if (pai.length > 1) {
      return fail(
        `${pai.length} P-Asserted-Identity headers reach the service provider; it reads the first`,
        "out",
        "P-Asserted-Identity"
      )
    }
  }
)

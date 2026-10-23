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
import { Finding, Profile, Severity } from "../../types"
import { headerValues, outbound } from "../facts"
import { towardServiceProvider } from "./scope"

export default defineRule(
  {
    id: "sip-connect/privacy",
    profile: Profile.SIP_CONNECT,
    severity: Severity.ERROR,
    spec: "RFC 3323 §4.2, RFC 3325 §9.3, SIPconnect 1.1 privacy (test 1.3.4)",
    summary:
      "With Privacy: id the From is anonymous and the identity travels only in P-Asserted-Identity"
  },
  ({ record }, fail) => {
    if (!towardServiceProvider(record)) return
    const out = outbound(record)
    const privacy = headerValues(out, "Privacy").join(";").toLowerCase()
    if (!/\bid\b/.test(privacy)) return
    const findings: Finding[] = []
    const from = out?.from?.address
    const anonymous =
      from?.uri?.user?.toLowerCase() === "anonymous" ||
      from?.uri?.host?.toLowerCase() === "anonymous.invalid"
    if (!anonymous) {
      findings.push(
        fail(
          "Privacy: id requested but From still names the caller",
          "out",
          "From"
        )
      )
    }
    if (headerValues(out, "P-Asserted-Identity").length === 0) {
      findings.push(
        fail(
          "Privacy: id requested but no P-Asserted-Identity carries the identity for the provider",
          "out",
          "P-Asserted-Identity"
        )
      )
    }
    return findings
  }
)

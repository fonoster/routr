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
import { isExternalHost, isForwarded, isInternalHost, outbound } from "../facts"

export default defineRule(
  {
    id: "sip/private-address",
    profile: Profile.SIP,
    severity: Severity.WARNING,
    spec: "RFC 3261 §8.1.1.8, RFC 3264 §5",
    summary:
      "A request leaving through the external interface names no internal address in Contact or SDP"
  },
  ({ record }, fail) => {
    if (!isForwarded(record)) return
    const out = outbound(record)
    if (!out || !isExternalHost(record.request, out.via?.[0]?.host)) return
    const internal = (host: string | undefined) =>
      !!host && isInternalHost(record.request, host)
    const findings: Finding[] = []
    const contact = out.contact?.address?.uri?.host
    if (internal(contact)) {
      findings.push(
        fail(
          `Contact names ${contact}, an internal address the far side cannot reach`,
          "out",
          "Contact"
        )
      )
    }
    const c = /^c=IN IP4 (\S+)/m.exec(out.body || "")?.[1]
    if (internal(c)) {
      findings.push(
        fail(
          `SDP connection address ${c} is internal; media needs a relay`,
          "out",
          "Body"
        )
      )
    }
    return findings
  }
)

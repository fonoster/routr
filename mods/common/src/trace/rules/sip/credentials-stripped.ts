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
import { headerValues, inbound, isForwarded, outbound } from "../facts"

export default defineRule(
  {
    id: "sip/credentials-stripped",
    profile: Profile.SIP,
    severity: Severity.ERROR,
    spec: "RFC 3261 §22.2",
    summary:
      "Credentials the proxy accepted are not forwarded; the next hop would receive the digest"
  },
  ({ record }, fail) => {
    if (!isForwarded(record)) return
    const accepted =
      !!inbound(record).authorization ||
      headerValues(inbound(record), "Authorization").length > 0
    if (!accepted) return
    const out = outbound(record)
    if (out?.authorization || headerValues(out, "Authorization").length) {
      return fail(
        "Authorization the proxy accepted was forwarded to the next hop",
        "out",
        "Authorization"
      )
    }
  }
)

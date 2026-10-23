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
import { inbound, isForwarded, isOwnHost, isRelayed, outbound } from "../facts"

export default defineRule(
  {
    id: "sip/via",
    profile: Profile.SIP,
    severity: Severity.ERROR,
    spec: "RFC 3261 §16.6 step 8, §16.7 step 3",
    summary:
      "The proxy's own Via goes on top of a forwarded request and comes off a relayed response"
  },
  ({ record }, fail) => {
    const viaIn = inbound(record).via || []
    const viaOut = outbound(record)?.via || []
    if (isForwarded(record)) {
      if (viaOut.length !== viaIn.length + 1) {
        return fail(
          `expected ${
            viaIn.length + 1
          } Via headers on the outgoing request, found ${viaOut.length}`,
          "out",
          "Via"
        )
      }
      if (!isOwnHost(record.request, viaOut[0]?.host)) {
        return fail(
          `top Via of the outgoing request is ${viaOut[0]?.host}, not one of the proxy's interfaces`,
          "out",
          "Via"
        )
      }
    } else if (isRelayed(record)) {
      if (viaOut.length !== viaIn.length - 1) {
        return fail(
          `expected ${
            viaIn.length - 1
          } Via headers on the relayed response, found ${viaOut.length}`,
          "out",
          "Via"
        )
      }
      if (viaIn.length && !isOwnHost(record.request, viaIn[0]?.host)) {
        return fail(
          `top Via of the incoming response is ${viaIn[0]?.host}, not one of the proxy's interfaces`,
          "in",
          "Via"
        )
      }
    }
  }
)

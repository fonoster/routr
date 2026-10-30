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
import { isAliasHost, isForwarded, isOwnHost, outbound } from "../facts"

export default defineRule(
  {
    id: "sip/route-self-removed",
    profile: Profile.SIP,
    severity: Severity.ERROR,
    spec: "RFC 3261 §16.4",
    summary: "A Route pointing at the proxy itself is removed before forwarding"
  },
  ({ record }, fail) => {
    if (!isForwarded(record)) return
    const own = (outbound(record)?.route || []).find(
      (r) =>
        isOwnHost(record.request, r.address?.uri?.host) ||
        isAliasHost(record.request, r.address?.uri?.host)
    )
    if (own) {
      return fail(
        `outgoing request still carries a Route to ${own.address.uri.host}, one of the proxy's interfaces`,
        "out",
        "Route"
      )
    }
  }
)

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
import { isE164, outbound } from "../facts"
import { towardServiceProvider } from "./scope"

export default defineRule(
  {
    id: "sip-connect/from-e164-or-anonymous",
    profile: Profile.SIP_CONNECT,
    severity: Severity.WARNING,
    spec: "SIPconnect 1.1, calling party identity and privacy (tests 1.3.1, 1.3.4)",
    summary: "From carries an E.164 number or the anonymous identity"
  },
  ({ record }, fail) => {
    if (!towardServiceProvider(record)) return
    const from = outbound(record)?.from?.address?.uri
    if (!from) return
    const anonymous =
      from.user?.toLowerCase() === "anonymous" ||
      from.host?.toLowerCase() === "anonymous.invalid"
    if (!anonymous && !isE164(from.user)) {
      return fail(
        `From user ${from.user ?? ""} is neither E.164 nor anonymous`,
        "out",
        "From"
      )
    }
  }
)

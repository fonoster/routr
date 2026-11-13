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
    id: "sip-connect/request-uri-e164",
    profile: Profile.SIP_CONNECT,
    severity: Severity.ERROR,
    spec: "SIPconnect 1.1, called party number, E.164 with user=phone (test 1.3.1)",
    summary: "The Request-URI to the service provider is E.164 with user=phone"
  },
  ({ record }, fail) => {
    if (!towardServiceProvider(record)) return
    const uri = outbound(record)?.requestUri
    if (!uri) return
    if (!isE164(uri.user)) {
      return fail(
        `Request-URI user ${uri.user ?? ""} is not E.164`,
        "out",
        "Request-URI"
      )
    }
    if (uri.userParam !== "phone") {
      return fail("Request-URI lacks user=phone", "out", "Request-URI")
    }
  }
)

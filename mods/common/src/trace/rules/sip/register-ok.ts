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
import { Profile, Severity, TraceOutcome } from "../../types"
import { inbound, isRequest, outbound, statusOf } from "../facts"

export default defineRule(
  {
    id: "sip/register-ok",
    profile: Profile.SIP,
    severity: Severity.ERROR,
    spec: "RFC 3261 §10.3 step 8",
    summary:
      "A 200 to REGISTER carries the Contact bound and an expiration (the EdgePort copies the request's Expires)"
  },
  ({ record }, fail) => {
    if (
      !isRequest(record) ||
      record.method !== "REGISTER" ||
      record.outcome !== TraceOutcome.ANSWERED ||
      statusOf(record) !== 200
    ) {
      return
    }
    const out = outbound(record)
    if (!out?.contact) {
      return fail("200 to REGISTER carries no Contact", "out", "Contact")
    }
    const inMsg = inbound(record)
    const candidates = [
      out.expires?.expires,
      out.contact.expires,
      inMsg.expires?.expires,
      inMsg.contact?.expires
    ]
    if (!candidates.some((e) => typeof e === "number" && e >= 0)) {
      return fail(
        "200 to REGISTER carries no expiration and the request had none",
        "out",
        "Expires"
      )
    }
  }
)

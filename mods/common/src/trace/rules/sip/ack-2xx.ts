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
import { cseqOf, inbound, isRequest, isResponse, statusOf } from "../facts"

export default defineRule(
  {
    id: "sip/ack-2xx",
    profile: Profile.SIP,
    severity: Severity.WARNING,
    spec: "RFC 3261 §13.2.2.4",
    summary: "A 2xx to INVITE is acknowledged before the dialog is torn down"
  },
  ({ record, call }, fail) => {
    if (!isRequest(record) || record.method !== "BYE") return
    const unacked = call
      .filter(
        (r) =>
          isResponse(r) &&
          r.method === "INVITE" &&
          (statusOf(r) ?? 0) >= 200 &&
          (statusOf(r) ?? 0) < 300
      )
      .filter((ok) => {
        const n = cseqOf(inbound(ok))?.number
        return !call.some(
          (r) =>
            isRequest(r) &&
            r.method === "ACK" &&
            r.seq > ok.seq &&
            cseqOf(inbound(r))?.number === n
        )
      })
    if (unacked.length) {
      return fail(
        `BYE arrived while the 2xx to INVITE (CSeq ${
          cseqOf(inbound(unacked[0]))?.number
        }) was never acknowledged`,
        "call"
      )
    }
  }
)

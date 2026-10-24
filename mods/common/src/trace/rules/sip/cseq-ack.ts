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
import { cseqOf, inbound, isRequest } from "../facts"

export default defineRule(
  {
    id: "sip/cseq-ack",
    profile: Profile.SIP,
    severity: Severity.ERROR,
    spec: "RFC 3261 §17.1.1.3, §13.2.2.4",
    summary: "An ACK carries the CSeq number of the INVITE it acknowledges"
  },
  ({ record, call }, fail) => {
    if (!isRequest(record) || record.method !== "ACK") return
    const cseq = cseqOf(inbound(record))
    const invites = call.filter((r) => isRequest(r) && r.method === "INVITE")
    if (!cseq || invites.length === 0) return
    if (!invites.some((r) => cseqOf(inbound(r))?.number === cseq.number)) {
      return fail(
        `ACK CSeq ${cseq.number} matches no INVITE of this call`,
        "in",
        "CSeq"
      )
    }
  }
)

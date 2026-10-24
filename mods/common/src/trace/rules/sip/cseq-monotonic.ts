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
import {
  cseqOf,
  directionOf,
  inbound,
  isRequest,
  requestsIn,
  topBranch
} from "../facts"

// ACK and CANCEL reuse the CSeq number of their INVITE
const SHARES_CSEQ = new Set(["ACK", "CANCEL"])

export default defineRule(
  {
    id: "sip/cseq-monotonic",
    profile: Profile.SIP,
    severity: Severity.ERROR,
    spec: "RFC 3261 §12.2.1.1",
    summary: "CSeq grows with every new request a party sends within a dialog"
  },
  ({ record, call }, fail) => {
    if (!isRequest(record) || SHARES_CSEQ.has(record.method)) return
    const cseq = cseqOf(inbound(record))
    if (!cseq) return
    const direction = directionOf(record)
    const branch = topBranch(inbound(record))
    const previous = requestsIn(call)
      .filter(
        (r) =>
          directionOf(r) === direction &&
          !SHARES_CSEQ.has(r.method) &&
          topBranch(inbound(r)) !== branch
      )
      .map((r) => cseqOf(inbound(r))?.number)
      .filter((n): n is number => n !== undefined)
    const highest = previous.length ? Math.max(...previous) : undefined
    if (highest !== undefined && cseq.number <= highest) {
      return fail(
        `${record.method} CSeq ${cseq.number} does not exceed the previous ${highest} from the same party`,
        "in",
        "CSeq"
      )
    }
  }
)

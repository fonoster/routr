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
import { cseqOf, inbound, isRequest, requestsIn, topBranch } from "../facts"

export default defineRule(
  {
    id: "sip/retransmission",
    profile: Profile.SIP,
    severity: Severity.WARNING,
    spec: "RFC 3261 §17.1.1.2, §17.1.2.2",
    summary:
      "A request seen twice with the same branch means its response did not reach the sender in time"
  },
  ({ record, call }, fail) => {
    if (!isRequest(record)) return
    const branch = topBranch(inbound(record))
    const cseq = cseqOf(inbound(record))?.number
    if (!branch || cseq === undefined) return
    const earlier = requestsIn(call).find(
      (r) =>
        r.method === record.method &&
        topBranch(inbound(r)) === branch &&
        cseqOf(inbound(r))?.number === cseq
    )
    if (earlier) {
      return fail(
        `${record.method} retransmitted ${Math.round(
          record.tOffsetMs - earlier.tOffsetMs
        )} ms after the first copy (seq ${
          earlier.seq
        }): the sender had not seen a response`,
        "in",
        "Via"
      )
    }
  }
)

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
import { inbound, isForwarded, outbound } from "../facts"

export default defineRule(
  {
    id: "sip/max-forwards",
    profile: Profile.SIP,
    severity: Severity.ERROR,
    spec: "RFC 3261 §16.6 step 3, §16.3",
    summary: "A proxy decrements Max-Forwards by one and never forwards zero"
  },
  ({ record }, fail) => {
    if (!isForwarded(record)) return
    const mfIn = inbound(record).maxForwards?.maxForwards
    const mfOut = outbound(record)?.maxForwards?.maxForwards
    if (mfIn === undefined) {
      return mfOut === undefined
        ? fail(
            "Max-Forwards missing on the outgoing request",
            "out",
            "Max-Forwards"
          )
        : undefined
    }
    if (mfIn === 0) {
      return fail(
        "forwarded a request whose Max-Forwards was 0 (should answer 483)",
        "in",
        "Max-Forwards"
      )
    }
    if (mfOut !== mfIn - 1) {
      return fail(
        `Max-Forwards not decremented (${mfIn} in, ${mfOut ?? "none"} out)`,
        "out",
        "Max-Forwards"
      )
    }
  }
)

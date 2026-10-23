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
  isExternalHost,
  isForwarded,
  isInDialog,
  isInternalHost,
  isOwnHost,
  outbound
} from "../facts"

export default defineRule(
  {
    id: "sip/record-route-self",
    profile: Profile.SIP,
    severity: Severity.WARNING,
    spec: "RFC 3261 §16.6 step 4",
    summary:
      "A Record-Route the proxy adds names one of its own interfaces, and one the far side can reach"
  },
  ({ record }, fail) => {
    if (!isForwarded(record) || isInDialog(record)) return
    const out = outbound(record)
    const rr = out?.recordRoute?.[0]?.address?.uri?.host
    if (!rr) return
    if (!isOwnHost(record.request, rr)) {
      return fail(
        `top Record-Route names ${rr}, not one of the proxy's interfaces`,
        "out",
        "Record-Route"
      )
    }
    const via = out?.via?.[0]?.host
    if (
      isExternalHost(record.request, via) &&
      isInternalHost(record.request, rr)
    ) {
      return fail(
        `Record-Route names ${rr}, an internal interface, while the request leaves through ${via}`,
        "out",
        "Record-Route"
      )
    }
  }
)

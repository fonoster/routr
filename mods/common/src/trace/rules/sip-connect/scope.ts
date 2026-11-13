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
import { TraceRecord } from "../../types"
import { NumberFormat } from "../../../types"
import { isExternalHost, isForwarded, isInDialog, outbound } from "../facts"

/**
 * Whether a record is a dialog-creating INVITE the proxy forwards out of
 * its external interface, which is where SIPconnect 1.1 applies. The
 * external interface is a fact of the EdgePort (externalAddrs); the top
 * Via of the outgoing request names the interface the request leaves by.
 *
 * @param {TraceRecord} r - The record
 * @return {boolean} True when the SIP Connect rules apply
 */
export function towardServiceProvider(r: TraceRecord): boolean {
  if (!isForwarded(r) || r.method !== "INVITE" || isInDialog(r)) return false
  return isExternalHost(r.request, outbound(r)?.via?.[0]?.host)
}

/**
 * Whether the Trunk a call leaves through asked for its numbers in a form
 * that is not +E.164 (calledNumberFormat or callerNumberFormat, which the
 * Connect processor annotates on its hop). That is a deliberate deviation
 * from SIPconnect 1.1 an operator configured for a carrier that requires it,
 * so the E.164 rules have nothing to report for the party.
 *
 * @param {TraceRecord} r - The record
 * @param {string} key - The hop annotation: calledNumberFormat or callerNumberFormat
 * @return {boolean} True when a hop names a format other than E164
 */
export function trunkChoseAnotherFormat(
  r: TraceRecord,
  key: "calledNumberFormat" | "callerNumberFormat"
): boolean {
  return (r.hops ?? []).some((hop) => {
    const format = hop.metadata?.[key]
    return !!format && format !== NumberFormat.E164
  })
}

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
import { Finding, Profile, TraceRecord } from "../types"
import { EvaluateOptions, Rule, RuleContext } from "./types"
import maxForwards from "./sip/max-forwards"
import via from "./sip/via"
import recordRouteSelf from "./sip/record-route-self"
import routeSelfRemoved from "./sip/route-self-removed"
import credentialsStripped from "./sip/credentials-stripped"
import privateAddress from "./sip/private-address"
import registerOk from "./sip/register-ok"
import cseqAck from "./sip/cseq-ack"
import cseqMonotonic from "./sip/cseq-monotonic"
import cancelMatches from "./sip/cancel-matches"
import ack2xx from "./sip/ack-2xx"
import retransmission from "./sip/retransmission"
import paiSingle from "./sip-connect/pai-single"
import paiE164 from "./sip-connect/pai-e164"
import requestUriE164 from "./sip-connect/request-uri-e164"
import fromE164OrAnonymous from "./sip-connect/from-e164-or-anonymous"
import privacy from "./sip-connect/privacy"

export * from "./types"
export * as Facts from "./facts"
export { towardServiceProvider } from "./sip-connect/scope"

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const RULESET_VERSION: string = require("../../../package.json").version

/** Every rule, in evaluation order. */
export const RULES: ReadonlyArray<Rule> = [
  maxForwards,
  via,
  recordRouteSelf,
  routeSelfRemoved,
  credentialsStripped,
  privateAddress,
  registerOk,
  cseqAck,
  cseqMonotonic,
  cancelMatches,
  ack2xx,
  retransmission,
  paiSingle,
  paiE164,
  requestUriE164,
  fromE164OrAnonymous,
  privacy
]

export const DEFAULT_PROFILES: Profile[] = [Profile.SIP]

/**
 * Returns the rules of the given profiles.
 *
 * @param {Profile[]} profiles - Profiles to evaluate
 * @return {Rule[]} The matching rules
 */
export function rulesFor(profiles: Profile[]): Rule[] {
  return RULES.filter((r) => profiles.includes(r.profile))
}

/**
 * Evaluates the rules of the given profiles on one record.
 *
 * @param {TraceRecord} record - The record
 * @param {TraceRecord[]} call - Earlier records of the same call, oldest first
 * @param {EvaluateOptions} options - Which profiles to evaluate
 * @return {Finding[]} The findings, errors first
 */
export function evaluate(
  record: TraceRecord,
  call: TraceRecord[],
  options: EvaluateOptions = { profiles: DEFAULT_PROFILES }
): Finding[] {
  const ctx: RuleContext = { record, call }
  const findings = rulesFor(options.profiles).flatMap((rule) => {
    const fail = (
      message: string,
      side: Finding["side"] = "out",
      header?: string
    ): Finding => ({
      rule: rule.id,
      profile: rule.profile,
      severity: rule.severity,
      spec: rule.spec,
      message,
      side,
      ...(header ? { header } : {})
    })
    const result = rule.check(ctx, fail)
    return result ? (Array.isArray(result) ? result : [result]) : []
  })
  return findings.sort((a, b) => rank(a) - rank(b))
}

/**
 * Evaluates every record of a call in order, each with the records before
 * it as context.
 *
 * @param {TraceRecord[]} records - The whole call, oldest first
 * @param {EvaluateOptions} options - Which profiles to evaluate
 * @return {Map<number, Finding[]>} Findings by record seq (only non-empty)
 */
export function evaluateAll(
  records: TraceRecord[],
  options: EvaluateOptions = { profiles: DEFAULT_PROFILES }
): Map<number, Finding[]> {
  const out = new Map<number, Finding[]>()
  records.forEach((record, i) => {
    const findings = evaluate(record, records.slice(0, i), options)
    if (findings.length) out.set(record.seq, findings)
  })
  return out
}

const rank = (f: Finding) => (f.severity === "error" ? 0 : 1)

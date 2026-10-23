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
import { Finding, Profile, Severity, TraceRecord } from "../types"

/**
 * What a rule sees: the record being evaluated and the earlier records of
 * the same Call-ID, oldest first. In rctl `call` holds the whole file up to
 * this record; in the dispatcher it holds the configured window.
 */
export interface RuleContext {
  record: TraceRecord
  call: TraceRecord[]
}

export interface RuleMeta {
  // e.g. "sip/max-forwards"
  id: string
  profile: Profile
  severity: Severity
  // Spec citation shown with the finding
  spec: string
  // One line, what the rule checks
  summary: string
}

/** Builds a finding for the rule being evaluated. */
export type Fail = (
  message: string,
  side?: Finding["side"],
  header?: string
) => Finding

export type Check = (
  ctx: RuleContext,
  fail: Fail
) => Finding | Finding[] | undefined | void

export interface Rule extends RuleMeta {
  check: Check
}

export interface EvaluateOptions {
  profiles: Profile[]
}

/**
 * Declares a rule: its metadata and one pure function over the context.
 *
 * @param {RuleMeta} meta - Id, profile, severity, spec and summary
 * @param {Check} check - Returns the findings, if any
 * @return {Rule} The rule
 */
export function defineRule(meta: RuleMeta, check: Check): Rule {
  return { ...meta, check }
}

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
import { Trace } from "@routr/common"

export enum RecordingMode {
  // Record every call
  ALL = "all",
  // Record only calls a processor flags (e.g. a trunk with recordMessages)
  FLAGGED = "flagged"
}

export interface RecordingConfig {
  enabled: boolean
  // Directory where one .jsonl file per call is written
  path: string
  mode?: RecordingMode
  // Stop writing a call after this many records
  maxRecordsPerCall?: number
  // Stop starting new recordings when this many calls are active
  maxCalls?: number
  // Forget a call after this long without messages
  idleTimeoutSeconds?: number
  // Replace credentials with REDACTED before writing (default true). Turn it
  // off only on a test stack whose recordings feed the known-good corpus.
  redact?: boolean
  // Evaluate rules on every record as it is written; absent = off
  lint?: LintConfig
}

export interface LintConfig {
  // Rule profiles to evaluate; "sip" is always worth having
  profiles: Trace.Profile[]
  // Recent records of the same call kept in memory for call-scope rules
  window?: number
}

export const DEFAULT_RECORDING_PATH = "/var/routr/traces"

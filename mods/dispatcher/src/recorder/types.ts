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
}

/**
 * Builds a recording config from RECORD_MESSAGES, RECORD_MESSAGES_PATH and
 * RECORD_MESSAGES_MODE, on top of whatever the config file says. Returns the
 * file config untouched when none of the variables is set.
 *
 * @param {RecordingConfig} fromFile - The recording block of the config file
 * @param {NodeJS.ProcessEnv} env - Environment to read, defaults to process.env
 * @return {RecordingConfig | undefined} The effective recording config
 */
export function recordingFromEnv(
  fromFile?: RecordingConfig,
  env: NodeJS.ProcessEnv = process.env
): RecordingConfig | undefined {
  const enabled = env.RECORD_MESSAGES
  const path = env.RECORD_MESSAGES_PATH
  const mode = env.RECORD_MESSAGES_MODE

  if (enabled === undefined && path === undefined && mode === undefined) {
    return fromFile
  }

  if (
    mode !== undefined &&
    !Object.values(RecordingMode).includes(mode as RecordingMode)
  ) {
    throw new Error(
      `RECORD_MESSAGES_MODE must be one of ${Object.values(RecordingMode).join(
        ", "
      )}`
    )
  }

  return {
    ...fromFile,
    enabled: enabled !== undefined ? enabled === "true" : !!fromFile?.enabled,
    path: path ?? fromFile?.path ?? DEFAULT_RECORDING_PATH,
    ...(mode !== undefined ? { mode: mode as RecordingMode } : {})
  }
}

export const DEFAULT_RECORDING_PATH = "/var/routr/traces"

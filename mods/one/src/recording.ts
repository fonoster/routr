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
import { RecordingConfig, RecordingMode } from "@routr/dispatcher"

const DEFAULT_PATH = "/var/routr/traces"

/**
 * Routr One has no configuration file, so message recording is switched on
 * with RECORD_MESSAGES, RECORD_MESSAGES_PATH and RECORD_MESSAGES_MODE.
 * Credentials are always redacted and no rules are evaluated here; a
 * dispatcher configured from a file offers both.
 *
 * @param {NodeJS.ProcessEnv} env - Environment to read, defaults to process.env
 * @return {RecordingConfig | undefined} The recording config, or undefined when off
 */
export function recordingFromEnv(
  env: NodeJS.ProcessEnv = process.env
): RecordingConfig | undefined {
  const enabled = env.RECORD_MESSAGES
  const mode = env.RECORD_MESSAGES_MODE

  if (
    enabled === undefined &&
    mode === undefined &&
    !env.RECORD_MESSAGES_PATH
  ) {
    return undefined
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
    enabled: enabled === "true",
    path: env.RECORD_MESSAGES_PATH ?? DEFAULT_PATH,
    ...(mode !== undefined ? { mode: mode as RecordingMode } : {})
  }
}

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
import { z } from "zod/v4"
import { CommonErrors } from "@routr/common"
import { RecordingConfig } from "@routr/dispatcher"
import { recordingFromEnv } from "../recording"
import { ENV_MAP } from "./env_map"
import { LoadedOneConfig, LoadOneConfigParams } from "./load_one_config"

type LoadConfig = (params: LoadOneConfigParams) => LoadedOneConfig

const isFunction = (value: unknown): boolean => typeof value === "function"

export const resolveRecordingSchema = z.object({
  env: z.record(
    z.string(),
    z.string({ error: "env values must be strings" }).optional(),
    { error: "env must be an object of environment variables" }
  ),
  loadConfig: z.custom<LoadConfig>(isFunction, {
    error: "loadConfig must be a function"
  }),
  logger: z.object(
    {
      warn: z.custom<(message: string) => void>(isFunction, {
        error: "logger.warn must be a function"
      })
    },
    { error: "logger must have a warn function" }
  )
})

export type ResolveRecordingParams = z.infer<typeof resolveRecordingSchema>

// The env vars a spec.recording key replaces
const RECORDING_ENV_VARS = ENV_MAP.filter(({ key }) =>
  key.startsWith("recording.")
).map(({ envVar }) => envVar)

/**
 * Resolves the dispatcher's recording config from the routr-one file's
 * spec.recording, falling back to the RECORD_MESSAGES* env vars, and logs the
 * loader's warnings about those env vars.
 *
 * @param {ResolveRecordingParams} params - The environment, the loader and a logger
 * @return {RecordingConfig | undefined} The recording config, or undefined when off
 */
export function resolveRecording(
  params: ResolveRecordingParams
): RecordingConfig | undefined {
  const parsed = resolveRecordingSchema.safeParse(params)

  if (!parsed.success) {
    throw new CommonErrors.ValidationError(parsed.error)
  }

  const { env, loadConfig, logger } = parsed.data
  const { config, warnings } = loadConfig({ env })

  if (env.ROUTR_ONE_CONFIG_LOADED !== "1") {
    warnings
      .filter((warning) =>
        RECORDING_ENV_VARS.some((envVar) => warning.startsWith(`${envVar} `))
      )
      .forEach((warning) => logger.warn(warning))
  }

  const recording = config.spec.recording as RecordingConfig | undefined

  if (!recording) {
    return recordingFromEnv(env)
  }

  if (recording.mode !== undefined || env.RECORD_MESSAGES_MODE === undefined) {
    return recording
  }

  return {
    ...recording,
    mode: recordingFromEnv({ RECORD_MESSAGES_MODE: env.RECORD_MESSAGES_MODE })
      ?.mode
  }
}

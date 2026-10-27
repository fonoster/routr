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
import { LoadedOneConfig, LoadOneConfigParams } from "./load_one_config"
import { toExportLine } from "./to_export_line"

type LoadConfig = (params: LoadOneConfigParams) => LoadedOneConfig

type Write = (text: string) => void

const isFunction = (value: unknown): boolean => typeof value === "function"

export const printOneEnvSchema = z.object({
  env: z.record(
    z.string(),
    z.string({ error: "env values must be strings" }).optional(),
    { error: "env must be an object of environment variables" }
  ),
  loadConfig: z.custom<LoadConfig>(isFunction, {
    error: "loadConfig must be a function"
  }),
  stdout: z.custom<Write>(isFunction, { error: "stdout must be a function" }),
  stderr: z.custom<Write>(isFunction, { error: "stderr must be a function" })
})

export type PrintOneEnvParams = z.infer<typeof printOneEnvSchema>

/**
 * Loads the routr-one file and prints, for the image's startup shell to eval,
 * one export line per env var the file sets plus ROUTR_ONE_CONFIG_LOADED=1.
 * Warnings and errors go to stderr only; on an error stdout stays empty.
 *
 * @param {PrintOneEnvParams} params - The environment, the loader and the outputs
 * @return {number} The exit code: 0, or 1 when the file can't be loaded
 */
export function printOneEnv(params: PrintOneEnvParams): number {
  const parsed = printOneEnvSchema.safeParse(params)

  if (!parsed.success) {
    throw new CommonErrors.ValidationError(parsed.error)
  }

  const { env, loadConfig, stdout, stderr } = parsed.data

  const loaded = ((): LoadedOneConfig | undefined => {
    try {
      return loadConfig({ env })
    } catch (e) {
      stderr(`${(e as Error).message}\n`)
      return undefined
    }
  })()

  if (!loaded) {
    return 1
  }

  loaded.warnings.forEach((warning) => stderr(`${warning}\n`))

  const lines = Object.entries({
    ...loaded.env,
    ROUTR_ONE_CONFIG_LOADED: "1"
  }).map(([name, value]) => toExportLine({ name, value }))

  stdout(`${lines.join("\n")}\n`)

  return 0
}

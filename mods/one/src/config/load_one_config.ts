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
import { existsSync } from "fs"
import Ajv, { ErrorObject } from "ajv"
import { z } from "zod/v4"
import { CommonErrors, Config, Helper as H } from "@routr/common"
import { ENV_MAP, SECRET_KEYS } from "./env_map"
import { schema } from "./schema"

type Env = Record<string, string | undefined>

export const DEFAULT_CONFIG_PATH = "/etc/routr/one.yaml"

const PLACEHOLDER = "GENERATE-YOUR-OWN"

export const loadOneConfigSchema = z.object({
  path: z
    .string({ error: "path must be a file path" })
    .min(1, { error: "path must be a file path" })
    .optional(),
  env: z.record(
    z.string(),
    z.string({ error: "env values must be strings" }).optional(),
    { error: "env must be an object of environment variables" }
  )
})

export type LoadOneConfigParams = z.infer<typeof loadOneConfigSchema>

export interface OneConfig {
  kind: "RoutrOne"
  apiVersion: "v2beta1"
  ref: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spec: Record<string, any>
}

export interface LoadedOneConfig {
  config: OneConfig
  // Env var name to value, one entry per key set in the file
  env: Record<string, string>
  warnings: string[]
}

const ajv = new Ajv({ allErrors: true, coerceTypes: true })
const validate = ajv.compile(schema)

/**
 * Reads the value at a dotted key path, or undefined when any part is missing.
 *
 * @param {unknown} input - The object to read
 * @param {string} key - A dotted key path such as "signaling.localnets"
 * @return {unknown} The value, if set
 */
function getAt(input: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (current, part) =>
        current !== null && typeof current === "object"
          ? (current as Record<string, unknown>)[part]
          : undefined,
      input
    )
}

/**
 * Turns Ajv's errors into one message that names each key path, never a value.
 *
 * @param {ErrorObject[]} errors - The errors Ajv returned
 * @return {string} The message
 */
function formatErrors(errors: ErrorObject[]): string {
  return errors
    .map((e) => {
      const at = e.dataPath.replace(/^\./, "")
      const params = e.params as Record<string, string>
      if (e.keyword === "additionalProperties") {
        return `${[at, params.additionalProperty]
          .filter(Boolean)
          .join(".")}: unknown key`
      }
      if (e.keyword === "required") {
        const missing = params.missingProperty.replace(/^\./, "")
        return `${[at, missing].filter(Boolean).join(".")}: is required`
      }
      return `${at || "(root)"}: ${e.message}`
    })
    .join("; ")
}

/**
 * Converts a validated file value to the string its env var expects.
 *
 * @param {unknown} value - The value from the file
 * @param {boolean} inverted - Whether the env var means the opposite boolean
 * @return {string} The env var value
 */
function toEnvValue(value: unknown, inverted: boolean): string {
  if (Array.isArray(value)) return value.join(",")
  if (typeof value === "boolean") return String(inverted ? !value : value)
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

/**
 * Reads the file routr-one is configured with, resolves its ${VAR} and
 * secret:// references, validates it, and maps each key it sets to the env
 * var that key replaces. Env var values are never validated or rewritten.
 *
 * @param {LoadOneConfigParams} params - The file path and the environment
 * @return {LoadedOneConfig} The config, the env vars it sets and the warnings
 */
export function loadOneConfig(params: LoadOneConfigParams): LoadedOneConfig {
  const parsed = loadOneConfigSchema.safeParse(params)

  if (!parsed.success) {
    throw new CommonErrors.ValidationError(parsed.error)
  }

  const env: Env = parsed.data.env
  const explicitPath = parsed.data.path ?? (env.ROUTR_ONE_CONFIG || undefined)
  const path = explicitPath ?? DEFAULT_CONFIG_PATH

  const raw = ((): unknown => {
    if (!explicitPath && !existsSync(path)) {
      return {
        kind: "RoutrOne",
        apiVersion: "v2beta1",
        ref: "routr-one",
        spec: {}
      }
    }
    try {
      return H.readConfigFile(path)
    } catch (e) {
      const message = (e as Error).message
      throw new Error(message.includes(path) ? message : `${path}: ${message}`)
    }
  })()

  SECRET_KEYS.filter((key) => {
    const value = getAt(raw, `spec.${key}`)
    return typeof value === "string" && value.includes(PLACEHOLDER)
  }).forEach((key) => {
    throw new Error(
      `spec.${key}: replace the ${PLACEHOLDER} placeholder with your own secret`
    )
  })

  const interpolated = Config.interpolateEnv({ input: raw, env })
  const config = Config.resolveSecretRefs({ input: interpolated, env })

  if (!validate(config)) {
    throw new Error(`invalid config ${path}: ${formatErrors(validate.errors)}`)
  }

  const valid = config as OneConfig

  const outEnv = ENV_MAP.filter(
    ({ key }) => getAt(valid.spec, key) !== undefined
  ).reduce<Record<string, string>>(
    (acc, { key, envVar, inverted }) => ({
      ...acc,
      [envVar]: toEnvValue(getAt(valid.spec, key), inverted ?? false)
    }),
    {}
  )

  const warnings = ENV_MAP.filter(
    ({ envVar, imageDefault }) =>
      env[envVar] !== undefined && env[envVar] !== imageDefault
  ).map(({ key, envVar }) =>
    envVar in outEnv
      ? `${envVar} is ignored; spec.${key} in ${path} wins`
      : `${envVar} is deprecated; set spec.${key} in ${path}`
  )

  return { config: valid, env: outEnv, warnings }
}

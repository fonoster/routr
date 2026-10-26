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
import { ValidationError } from "../validation_error"

type Env = Record<string, string | undefined>

export const interpolateEnvSchema = z.object({
  input: z.unknown(),
  env: z.record(
    z.string(),
    z.string({ error: "env values must be strings" }).optional(),
    { error: "env must be an object of environment variables" }
  ),
  allowedPaths: z
    .array(z.string(), { error: "allowedPaths must be an array of key paths" })
    .optional()
})

export type InterpolateEnvParams<T> = Omit<
  z.infer<typeof interpolateEnvSchema>,
  "input"
> & { input: T }

/**
 * Shell / docker-compose style variable interpolation for config files.
 *
 * Supported forms inside any string value:
 *   - `${VAR}`          -> value of VAR; throws if VAR is unset or empty
 *   - `${VAR:-default}` -> value of VAR, or `default` when VAR is unset or empty
 *
 * Anything that is not a `${...}` reference is left untouched, so plain
 * literals (`http://asterisk:8088`, `$5.00`, ...) pass through unchanged.
 */
const VAR_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)(:-([^}]*))?\}/g
const HAS_REFERENCE = /\$\{[^}]*\}/

/**
 * Replaces every `${...}` reference in one string.
 *
 * @param {string} value - The string to interpolate
 * @param {Env} env - The environment to read variables from
 * @return {string} The interpolated string
 */
function interpolateString(value: string, env: Env): string {
  return value.replace(
    VAR_PATTERN,
    (
      _match,
      name: string,
      hasDefault: string | undefined,
      fallback: string
    ) => {
      const current = env[name]

      if (current !== undefined && current !== "") {
        return current
      }

      if (hasDefault !== undefined) {
        return fallback
      }

      throw new Error(
        `references undefined environment variable \${${name}} and no default was given`
      )
    }
  )
}

/**
 * Tells whether `${...}` may appear at a key path. `db.*` matches `db` and
 * everything below it; `*` alone matches every key.
 *
 * @param {string} path - The key path of the value
 * @param {string[]} allowedPaths - The allowed key path patterns
 * @return {boolean} true when the path is allowed
 */
function isAllowed(path: string, allowedPaths: string[]): boolean {
  return allowedPaths.some((pattern) => {
    if (pattern === "*") return true
    if (!pattern.endsWith(".*")) return path === pattern
    const prefix = pattern.slice(0, -2)
    return path === prefix || path.startsWith(`${prefix}.`)
  })
}

/**
 * Interpolates a value and everything below it.
 *
 * @param {unknown} input - The value to walk
 * @param {Env} env - The environment to read variables from
 * @param {string[]} allowedPaths - The allowed key paths, if any
 * @param {string} path - The key path of the value
 * @return {unknown} A copy of the value with references resolved
 */
function walk(
  input: unknown,
  env: Env,
  allowedPaths: string[] | undefined,
  path: string
): unknown {
  if (typeof input === "string") {
    if (!HAS_REFERENCE.test(input)) {
      return input
    }

    const where = path || "(root)"

    if (allowedPaths && !isAllowed(path, allowedPaths)) {
      throw new Error(
        `${where}: \${...} is only allowed at ${
          allowedPaths.join(", ") || "no key path here"
        }`
      )
    }

    try {
      return interpolateString(input, env)
    } catch (e) {
      throw new Error(`${where}: ${(e as Error).message}`)
    }
  }

  if (Array.isArray(input)) {
    return input.map((item, index) =>
      walk(item, env, allowedPaths, `${path}[${index}]`)
    )
  }

  if (input !== null && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        key,
        walk(value, env, allowedPaths, path ? `${path}.${key}` : key)
      ])
    )
  }

  return input
}

/**
 * Returns a copy of a parsed config with `${VAR}` and `${VAR:-default}`
 * references in its strings resolved from `env`. The input is not mutated.
 * Errors name the key path where they happened.
 *
 * @param {InterpolateEnvParams} params - The config, env and allowed paths
 * @return {T} A copy of the config with references resolved
 * @throws {ValidationError} When the params are invalid
 */
export function interpolateEnv<T>(params: InterpolateEnvParams<T>): T {
  const parsed = interpolateEnvSchema.safeParse(params)

  if (!parsed.success) {
    throw new ValidationError(parsed.error)
  }

  const { env, allowedPaths } = parsed.data

  return walk(params.input, env, allowedPaths, "") as T
}

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
import { readFileSync } from "fs"
import { isAbsolute, join, resolve } from "path"
import { z } from "zod/v4"
import { ValidationError } from "../validation_error"

type Env = Record<string, string | undefined>
type ReadFile = (path: string) => string

/**
 * `secret://` references in config values. A string value that is exactly a
 * reference is replaced by the secret it names, so YAML never holds the raw
 * secret:
 *
 *   secret://env/NAME                 the environment variable NAME
 *   secret://file/<absolute path>     a file's contents
 *   secret://k8s/<secret>#<key>       a Kubernetes Secret mounted as a volume,
 *   secret://k8s/<ns>/<secret>#<key>  read from <secretsDir>/<secret>/<key>
 *                                     (default ROUTR_SECRETS_DIR or
 *                                     /var/run/routr/secrets). The namespace,
 *                                     when given, must be the pod's
 *                                     (POD_NAMESPACE) if that is known.
 *
 * File contents lose one trailing newline. Errors name the key path and the
 * reference, never a value. Values that only contain `secret://` somewhere
 * else are left alone.
 */
const SECRET_PREFIX = "secret://"
const DEFAULT_SECRETS_DIR = "/var/run/routr/secrets"

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const K8S_NAME = /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/
const K8S_KEY = /^[-._a-zA-Z0-9]+$/

export const resolveSecretRefsSchema = z.object({
  input: z.unknown(),
  env: z
    .record(
      z.string(),
      z.string({ error: "env values must be strings" }).optional(),
      { error: "env must be an object of environment variables" }
    )
    .optional(),
  secretsDir: z
    .string({ error: "secretsDir must be a directory path" })
    .optional(),
  readFile: z
    .custom<ReadFile>((value) => typeof value === "function", {
      error: "readFile must be a function"
    })
    .optional()
})

export type ResolveSecretRefsParams<T> = Omit<
  z.infer<typeof resolveSecretRefsSchema>,
  "input"
> & { input: T }

type Options = Omit<ResolveSecretRefsParams<unknown>, "input"> & { env: Env }

/**
 * Tells whether a value is a `secret://` reference.
 *
 * @param {unknown} value - The value to check
 * @return {boolean} true when the value is a reference
 */
function isSecretRef(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(SECRET_PREFIX)
}

/**
 * Reads a secret file, dropping one trailing newline.
 *
 * @param {string} ref - The reference being resolved
 * @param {string} path - The file to read
 * @param {Options} options - The resolve options
 * @return {string} The file's contents
 */
function readSecretFile(ref: string, path: string, options: Options): string {
  const read =
    options.readFile ?? ((p: string) => readFileSync(p, { encoding: "utf8" }))
  try {
    return read(path).replace(/\r?\n$/, "")
  } catch (e) {
    const code = (e as { code?: string }).code
    throw new Error(`${ref}: cannot read ${path}${code ? ` (${code})` : ""}`)
  }
}

/**
 * Resolves one `secret://` reference. Throws with a message that never
 * contains the secret.
 *
 * @param {string} ref - The reference to resolve
 * @param {Options} options - The resolve options
 * @return {string} The secret
 */
function resolveSecretRef(ref: string, options: Options): string {
  const env = options.env
  const rest = ref.slice(SECRET_PREFIX.length)
  const slash = rest.indexOf("/")
  const kind = slash < 0 ? rest : rest.slice(0, slash)
  const target = slash < 0 ? "" : rest.slice(slash + 1)

  if (kind === "env") {
    if (!NAME.test(target)) throw new Error(`invalid variable name in ${ref}`)
    const value = env[target]
    if (value === undefined || value === "")
      throw new Error(`${ref}: environment variable ${target} is not set`)
    return value
  }

  if (kind === "file") {
    if (!target) throw new Error(`${ref}: missing file path`)
    return readSecretFile(ref, resolve("/", target), options)
  }

  if (kind === "k8s") {
    const hash = target.indexOf("#")
    if (hash < 0) throw new Error(`${ref}: missing #<key>`)
    const parts = target.slice(0, hash).split("/")
    const key = target.slice(hash + 1)
    if (parts.length > 2 || !parts.every((p) => K8S_NAME.test(p)))
      throw new Error(
        `${ref}: expected secret://k8s/[<namespace>/]<secret>#<key>`
      )
    if (!K8S_KEY.test(key)) throw new Error(`${ref}: invalid key`)
    const [namespace, name] = parts.length === 2 ? parts : [undefined, parts[0]]
    const podNamespace = env.POD_NAMESPACE
    if (namespace && podNamespace && namespace !== podNamespace)
      throw new Error(
        `${ref}: Secrets of namespace ${namespace} are not mounted here (${podNamespace})`
      )
    const dir =
      options.secretsDir ?? env.ROUTR_SECRETS_DIR ?? DEFAULT_SECRETS_DIR
    const base = isAbsolute(dir) ? dir : resolve(dir)
    return readSecretFile(ref, join(base, name, key), options)
  }

  throw new Error(
    `unsupported reference ${ref} (use secret://env/NAME, secret://file/<path> or secret://k8s/<secret>#<key>)`
  )
}

/**
 * Resolves the references in a value and everything below it.
 *
 * @param {unknown} input - The value to walk
 * @param {Options} options - The resolve options
 * @param {string} path - The key path of the value
 * @return {unknown} A copy of the value with references resolved
 */
function walk(input: unknown, options: Options, path: string): unknown {
  if (isSecretRef(input)) {
    try {
      return resolveSecretRef(input, options)
    } catch (e) {
      throw new Error(`${path || "(root)"}: ${(e as Error).message}`)
    }
  }

  if (Array.isArray(input)) {
    return input.map((item, i) => walk(item, options, `${path}[${i}]`))
  }

  if (input !== null && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).map(([k, v]) => [
        k,
        walk(v, options, path ? `${path}.${k}` : k)
      ])
    )
  }

  return input
}

/**
 * Returns a copy of a parsed config with every `secret://` value resolved.
 * Errors name the key path and the reference
 * (`db.url: secret://env/DB: environment variable DB is not set`).
 *
 * @param {ResolveSecretRefsParams} params - The config and resolve options
 * @return {T} A copy of the config with references resolved
 * @throws {ValidationError} When the params are invalid
 */
export function resolveSecretRefs<T>(params: ResolveSecretRefsParams<T>): T {
  const parsed = resolveSecretRefsSchema.safeParse(params)

  if (!parsed.success) {
    throw new ValidationError(parsed.error)
  }

  const { env, secretsDir, readFile } = parsed.data

  return walk(
    params.input,
    { env: env ?? process.env, secretsDir, readFile },
    ""
  ) as T
}

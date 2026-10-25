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
import * as E from "fp-ts/Either"
import fs from "fs"
import Ajv, { ErrorObject } from "ajv"
import { Helper as H } from "@routr/common"
import { schema } from "./schema"
import { DEFAULT_PROFILES, mergeProfiles } from "../profiles"
import { RTPEProfileOverrides, RTPRelayConfig } from "../types"

const ajv = new Ajv()
const validate = ajv.compile(schema)

type ConfigFile = {
  spec: {
    bindAddr?: string
    rtpengine?: { host?: string; port?: number }
    profiles?: RTPEProfileOverrides
  }
}

// Names the offending field, since "should NOT have additional properties"
// alone does not say which profile or key was mistyped.
const describe = (error: ErrorObject) => {
  const params = error.params as { additionalProperty?: string }
  const where = error.dataPath || "config"
  const extra = params.additionalProperty
    ? ` (${params.additionalProperty})`
    : ""
  return `${where} ${error.message}${extra}`
}

// The file is optional: without a path, or when nothing is at the path, the
// relay runs with the shipped profiles. A file that is there must validate,
// so a typo fails at startup instead of silently falling back to a default.
export const getConfig = (path?: string): E.Either<Error, RTPRelayConfig> => {
  if (!path || !fs.existsSync(path)) {
    return E.right({ profiles: DEFAULT_PROFILES })
  }

  try {
    const c = H.readConfigFile(path) as unknown as ConfigFile

    if (!validate(c)) {
      return E.left(new Error(describe(validate.errors[0])))
    }

    const { profiles, ...rest } = c.spec

    return E.right({
      ...rest,
      profiles: mergeProfiles(profiles),
      source: path
    })
  } catch (e) {
    return E.left(e instanceof Error ? e : new Error(String(e)))
  }
}

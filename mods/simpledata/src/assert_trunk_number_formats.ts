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
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"

// YAML writes the formats in kebab-case: e164-without-plus
const toNumberFormat = (format?: string) =>
  format?.replace(/-/g, "_").toUpperCase() as CT.NumberFormat | undefined

/**
 * Checks the number formats and prefixes of every Trunk in the resource
 * files with the rules the API Server applies on a write.
 *
 * @param {CC.UserConfig[]} resources - every resource read from the files
 * @throws {Error} naming the Trunk whose prefix breaks a rule
 */
export function assertTrunkNumberFormats(resources: CC.UserConfig[]): void {
  resources
    .filter((resource) => resource.kind === CC.Kind.TRUNK)
    .forEach((resource: CC.TrunkConfig) => {
      const spec = resource.spec ?? ({} as CC.TrunkConfig["spec"])
      try {
        CC.validateTrunkNumberFormat({
          calledNumberFormat: toNumberFormat(spec.calledNumberFormat),
          calledNumberPrefix: spec.calledNumberPrefix,
          callerNumberFormat: toNumberFormat(spec.callerNumberFormat),
          callerNumberPrefix: spec.callerNumberPrefix
        })
      } catch (e) {
        throw new Error(`Trunk ${resource.ref}: ${e.message}`)
      }
    })
}

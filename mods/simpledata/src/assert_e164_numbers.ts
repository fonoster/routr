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
import { CommonConnect as CC } from "@routr/common"

/**
 * With REQUIRE_E164_NUMBERS, checks that every Number in the resource files
 * has a tel:+E.164 telUrl, with the rule the API Server applies on create.
 * Off, nothing is checked, as before.
 *
 * @param {CC.UserConfig[]} resources - every resource read from the files
 * @param {boolean} requireE164 - REQUIRE_E164_NUMBERS
 * @throws {Error} naming the Number whose telUrl breaks the rule
 */
export function assertE164Numbers(
  resources: CC.UserConfig[],
  requireE164: boolean
): void {
  if (!requireE164) return

  resources
    .filter((resource) => resource.kind === CC.Kind.NUMBER)
    .forEach((resource: CC.NumberConfig) => {
      try {
        CC.validateTelUrl({
          telUrl: resource.spec?.location?.telUrl ?? "",
          requireE164
        })
      } catch (e) {
        throw new Error(`Number ${resource.ref}: ${e.message}`)
      }
    })
}

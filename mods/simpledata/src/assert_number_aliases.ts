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
 * Checks the aliases of every Number in the resource files with the rules the
 * API Server applies on a write: valid, and unique among the Numbers of one
 * Trunk.
 *
 * @param {CC.UserConfig[]} resources - every resource read from the files
 * @throws {Error} naming the first alias that breaks a rule
 */
export function assertNumberAliases(resources: CC.UserConfig[]): void {
  const numbers = resources
    .filter((resource) => resource.kind === CC.Kind.NUMBER)
    .map((resource: CC.NumberConfig) => ({
      ref: resource.ref,
      trunkRef: resource.spec?.trunkRef,
      aliases: resource.spec?.location?.aliases ?? []
    }))

  numbers.forEach((number) =>
    CC.validateNumberAliases({
      number,
      trunkNumbers: numbers.filter(
        (other) => other.trunkRef === number.trunkRef
      )
    })
  )
}

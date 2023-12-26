/* eslint-disable require-jsdoc */
/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
import { findByRef } from "./find"

export function numbersLoader(
  config: CC.UserConfig,
  list: CC.UserConfig[]
): CC.INumber {
  if (config.kind !== CC.Kind.NUMBER)
    throw new Error("invalid resource type `Number`")

  const number = CC.mapToNumber(config)
  number.trunk = findByRef(config.spec.trunkRef, list) as CC.Trunk

  return number
}

/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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
/* eslint-disable require-jsdoc */
import { CommonConnect as CC } from "@routr/common"
import { findByRef } from "./find"

export function trunksLoader(
  config: CC.UserConfig,
  list: CC.UserConfig[]
): CC.Trunk {
  if (config.kind !== CC.Kind.TRUNK)
    throw new Error("invalid resource type `Trunk`")

  const inbound = config.spec.inbound
  const outbound = config.spec.outbound
  const trunk = CC.mapToTrunk(config)

  trunk.inboundCredentials = findByRef(
    inbound.credentialsRef,
    list
  ) as CC.Credentials
  trunk.outboundCredentials = findByRef(
    outbound.credentialsRef,
    list
  ) as CC.Credentials
  trunk.accessControlList = findByRef(
    inbound.accessControlListRef,
    list
  ) as CC.AccessControlList

  return trunk
}

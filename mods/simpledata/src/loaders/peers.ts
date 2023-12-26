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

export function peersLoader(
  config: CC.UserConfig,
  list: CC.UserConfig[]
): CC.Peer {
  if (config.kind !== CC.Kind.PEER)
    throw new Error("invalid resource type `Peer`")

  const peer = CC.mapToPeer(config)
  peer.credentials = findByRef(
    config.spec.credentialsRef,
    list
  ) as CC.Credentials

  return peer
}

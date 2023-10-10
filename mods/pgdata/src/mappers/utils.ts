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
/* eslint-disable require-jsdoc */
import { CommonConnect as CC } from "@routr/common"
import { ACLManager } from "./acl"
import { AgentManager } from "./agent"
import { CredentialsManager } from "./credentials"
import { DomainManager } from "./domain"
import { NumberManager } from "./number"
import { PeerManager } from "./peer"
import { TrunkManager } from "./trunk"

export function getManager(kind: CC.KindWithoutUnknown) {
  switch (kind) {
    case CC.Kind.AGENT:
      return AgentManager
    case CC.Kind.PEER:
      return PeerManager
    case CC.Kind.ACL:
      return ACLManager
    case CC.Kind.CREDENTIALS:
      return CredentialsManager
    case CC.Kind.NUMBER:
      return NumberManager
    case CC.Kind.TRUNK:
      return TrunkManager
    case CC.Kind.DOMAIN:
      return DomainManager
  }
}

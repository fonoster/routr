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
import { agentsLoader } from "./agents"
import { domainsLoader } from "./domains"
import { credentialsLoader } from "./credentials"
import { trunksLoader } from "./trunks"
import { peersLoader } from "./peers"
import { numbersLoader } from "./numbers"
import { aclLoader } from "./acl"

export const getLoader = (kind: string) => {
  switch (kind) {
    case CC.Kind.AGENT:
      return agentsLoader
    case CC.Kind.DOMAIN:
      return domainsLoader
    case CC.Kind.PEER:
      return peersLoader
    case CC.Kind.NUMBER:
      return numbersLoader
    case CC.Kind.TRUNK:
      return trunksLoader
    case CC.Kind.CREDENTIALS:
      return credentialsLoader
    case CC.Kind.ACL:
      return aclLoader
  }
}

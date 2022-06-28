/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
 *
 * Licensed under the MIT License (the "License")
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
import {HeaderModifier} from "@routr/common"

export enum KIND {
  AGENT = "agent",
  PEER = "peer",
  NUMBER = "number",
  TRUNK = "trunk",
  DOMAIN = "domain",
  UNKNOWN = "unknown"
}

export enum ROUTING_DIRECTION {
  FROM_PSTN = "from-pstn",
  AGENT_TO_AGENT = "agent-to-agent",
  AGENT_TO_PSTN = "agent-to-pstn",
  PEER_TO_AGENT = "peer-to-agent",
  PEER_TO_PSTN = "peer-to-pstn",
  UNKNOWN = "unknown"
}

export interface ConnectProcessorConfig {
  bindAddr: string
  locationAddr: string
  apiAddr: string
}

export interface ConnectObject {
  headers?: HeaderModifier[]
}

export interface Resource {
  apiVersion: string
  kind: string
  metadata: {
    ref: string
    name: string
    linkTo?: Array<string>
  }
  spec: any
}

export interface DataAPI {
  get: (ref: string) => Promise<Resource>
  find: (query: string) => Promise<Resource[]>
}

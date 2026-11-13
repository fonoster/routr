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
import { HeaderModifier } from "@routr/common"

export enum RoutingDirection {
  FROM_PSTN = "from-pstn",
  AGENT_TO_AGENT = "agent-to-agent",
  AGENT_TO_PSTN = "agent-to-pstn",
  AGENT_TO_PEER = "agent-to-peer",
  // WARNING: This is not supported yet
  PEER_TO_AGENT = "peer-to-agent",
  PEER_TO_PSTN = "peer-to-pstn",
  UNKNOWN = "unknown"
}

// How the Number of a call from the PSTN was found (trace.numberMatch)
export enum NumberMatch {
  // The Request-URI user is the Number's telUrl
  EXACT = "exact",
  // The same digits, with or without the +
  DIGITS = "digits",
  // A national or international-prefix form of the Number
  NATIONAL = "national"
}

export interface ConnectProcessorConfig {
  bindAddr: string
  locationAddr: string
  apiAddr: string
}

export interface ConnectObject {
  headers?: HeaderModifier[]
}

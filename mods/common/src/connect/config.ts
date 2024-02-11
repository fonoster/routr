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
import { LoadBalancingAlgorithm, Privacy, Transport } from "../types"
import { Kind } from "./types"

export interface ConfigBase {
  apiVersion: string
  ref: string
  metadata: { name: string }
}

export interface AccessControlListConfig extends ConfigBase {
  kind: Kind.ACL
  spec: {
    accessControlList: {
      allow: string[]
      deny: string[]
    }
  }
}

export interface AgentConfig extends ConfigBase {
  kind: Kind.AGENT
  spec: {
    username: string
    domainRef: string
    credentialsRef: string
    privacy: Privacy
    maxContacts?: number
    expires?: number
    enabled: boolean
  }
}

export interface PeerConfig extends ConfigBase {
  kind: Kind.PEER
  spec: {
    aor: string
    username: string
    credentialsRef?: string
    contactAddr?: string
    enabled?: boolean
    maxContacts?: number
    expires?: number
    loadBalancing?: {
      algorithm: LoadBalancingAlgorithm
      withSessionAffinity: boolean
    }
  }
}

export interface CredentialsConfig extends ConfigBase {
  kind: Kind.CREDENTIALS
  spec: {
    credentials: {
      username: string
      password: string
    }
  }
}

export interface DomainConfig extends ConfigBase {
  kind: Kind.DOMAIN
  spec: {
    accessControlListRef?: string
    context: {
      domainUri: string
      egressPolicies?: { rule: string; numberRef: string }[]
    }
  }
}

export interface NumberConfig extends Omit<ConfigBase, "metadata"> {
  kind: Kind.NUMBER
  metadata: {
    name: string
    geoInfo: {
      city: string
      country: string
      countryISOCode: string
    }
  }
  spec: {
    trunkRef: string
    location: {
      telUrl: string
      aorLink: string
      sessionAffinityHeader: string
      extraHeaders: { name: string; value: string }[]
    }
  }
}

export interface TrunkConfig extends ConfigBase {
  kind: Kind.TRUNK
  spec: {
    inbound: {
      uri: string
      accessControlListRef: string
      credentialsRef: string
    }
    outbound: {
      sendRegister: boolean
      credentialsRef: string
      uris: {
        uri: {
          user: string
          host: string
          port: number
          transport: Transport
        }
        priority: number
        weight: number
        enabled: boolean
      }[]
    }
  }
}

export type UserConfig =
  | AccessControlListConfig
  | AgentConfig
  | PeerConfig
  | CredentialsConfig
  | DomainConfig
  | NumberConfig
  | TrunkConfig

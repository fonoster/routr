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
import {Method, Transport} from "@routr/common"
import {SIPMessage} from "@routr/common/src/types"

export const DEFAULT_MAX_FORWARDS = 70
export const DEFAULT_EXPIRES = 600

export enum KIND {
  AGENT = "agent",
  PEER = "peer",
  NUMBER = "number",
  TRUNK = "trunk",
  DOMAIN = "domain",
  UNKNOWN = "unknown",
  CREDENTIAL = "credential"
}

export enum FindCriteria {
  FIND_AGENT_BY_USERNAME = "find_agent_by_username",
  FIND_CREDENTIAL_BY_REFERENCE = "find_credential_by_reference",
  FIND_DOMAIN_BY_DOMAINURI = "find_domain_by_domainuri",
  FIND_NUMBER_BY_TELURL = "find_number_by_telurl",
  FIND_TRUNKS_WITH_SEND_REGISTER = "find_trunks_with_send_register"
}

export enum CACHE_PROVIDER {
  MEMORY = "memory",
  REDIS = "redis"
}

export enum RegistrationEntryStatus {
  REGISTERED = "registered",
  QUARANTINE = "quarantine"
}

export interface EdgePort {
  address: string
  region: string
  methods: Method[]
}

export interface RegistryConfig {
  bindAddr: string
  requesterAddr: string
  apiAddr: string
  edgePorts: EdgePort[]
  registerInterval: number
  cache?: {
    provider: CACHE_PROVIDER
    parameters?: string
  }
}

export interface RegistrationRequest {
  target: string
  method: Method
  transport: Transport
  message: SIPMessage
}

export interface SendMessageResponse {
  message: SIPMessage
}

export interface RedisStoreConfig {
  username?: string
  password?: string
  host: string
  port: number
  // dbNumber?: number
  secure?: boolean
}

export interface RequestParams {
  user: string
  targetDomain: string
  targetAddress: string
  proxyAddress: string
  transport: Transport
  userAgent?: string
  allow?: Method[]
  maxForwards?: number
  expires?: number
  secure?: boolean
  auth?: {
    username: string
    secret: string
  }
  // TODO: Create SIPEvents Enum
  // allowEvents:
}

export interface RegistrationEntry {
  trunkRef: string
  timeOfEntry: number
  // Time after which the store will remove this record
  retentionTimeInSeconds: number
  status: RegistrationEntryStatus
}

export interface IRegistryStore {
  put(key: string, entry: RegistrationEntry): Promise<void>

  get(key: string): Promise<RegistrationEntry>

  delete(key: string): Promise<void>

  list(): Promise<RegistrationEntry[]>
}

export interface Trunk {
  ref: string
  name: string
  region: string
  host: string
  port: number
  username?: string
  secret?: string
  transport: Transport
}

export interface Resource {
  apiVersion: string
  kind: string
  metadata: {
    ref: string
    name: string
    linkTo?: Array<string>
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spec: Record<string, any>
}

export interface DataAPI {
  get: (ref: string) => Promise<Resource>
  findBy: (request: FindParameters) => Promise<Resource[]>
}

export interface FindParameters {
  kind: KIND
  criteria: FindCriteria
  parameters: Record<string, string>
}

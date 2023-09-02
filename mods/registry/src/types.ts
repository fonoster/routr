/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
import { Method, Transport } from "@routr/common"
import { CommonTypes } from "@routr/common"

export const DEFAULT_MAX_FORWARDS = 70
export const DEFAULT_EXPIRES = 600

export enum CacheProvider {
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
}

export interface RegistryConfig {
  requesterAddr: string
  apiAddr: string
  edgePorts: EdgePort[]
  registerInterval: number
  methods: Method[]
  cache?: {
    provider: CacheProvider
    parameters?: string
  }
}

export interface RegistrationRequest {
  trunkRef: string
  target: string
  user: string
  method: Method
  transport: Transport
  message: CommonTypes.SIPMessage
}

export interface SendMessageResponse {
  trunkRef: string
  message: CommonTypes.SIPMessage
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
  trunkRef: string
  targetDomain: string
  targetAddress: string
  proxyAddress: string
  transport: Transport
  userAgent?: string
  // TODO: Perhaps this should be renamed to allowMethods
  methods?: Method[]
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
  // The user part might be different from the credentials username
  user: string
  credentials?: {
    username: string
    secret: string
  }
  transport: Transport
}

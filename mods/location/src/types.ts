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
import { Route } from "@routr/common"

export enum LoadBalancingAlgorithm {
  ROUND_ROBIN = "round-robin",
  LEAST_SESSIONS = "least-sessions"
}

export enum CacheProvider {
  MEMORY = "memory",
  REDIS = "redis"
}

export interface ILocationService {
  addRoute(request: AddRouteRequest): Promise<void>
  findRoutes(request: FindRoutesRequest): Promise<Route[]>
  removeRoutes(request: RemoveRoutesRequest): Promise<void>
}

export interface ILocatorStore {
  put(key: string, route: Route): Promise<void>
  get(key: string): Promise<Route[]>
  delete(key: string): Promise<void>
}

export interface AddRouteRequest {
  aor: string
  route: Route
}

export interface FindRoutesRequest {
  aor: string
  callId: string
  sessionAffinityRef?: string
  // Reserved for future use
  labels?: Map<string, string>
}

export interface FindRoutesResponse {
  routes: Array<Route>
}

export interface RemoveRoutesRequest {
  aor: string
}

export interface Backend {
  ref: string
  balancingAlgorithm?: LoadBalancingAlgorithm
  withSessionAffinity?: boolean
}

export interface LocationConfig {
  bindAddr: string
  backends?: Backend[]
  cache?: {
    provider: CacheProvider
    parameters?: string
  }
}

export interface RedisStoreConfig {
  username?: string
  password?: string
  host: string
  port: number
  // dbNumber?: number
  secure?: boolean
}

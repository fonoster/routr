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
export enum Method {
  UNKNOWN = 'UNKNOWN',
  REGISTER = 'REGISTER',
  INVITE = 'INVITE',
  MESSAGE = 'MESSAGE',
  PUBLISH = 'PUBLISH',
  NOTIFY = 'NOTIFY',
  SUBSCRIBE = 'SUBSCRIBE'
}

export enum Transport {
  TCP = 'TCP',
  UDP = 'UDP',
  TLS = 'TLS',
  SCTP = 'SCTP',
  WS = 'WS',
  WSS = 'WSS',
}

export interface NetInterface {
  host: string
  port: number
  transport: Transport
}

export interface MessageRequest {
  ref: string
  edgePortRef: string
  method: Method
  sender: NetInterface
  listeningPoint: NetInterface
  externalIps: string[]
  localnets: string[]
  message: Record<string, unknown>
}

export interface MessageResponse {
  message: Record<string, unknown>
}

export interface ProcessorConfig {
  ref: string
  addr: string
  methods: Array<Method>
  matchFunc?: (request: MessageRequest) => boolean
}

export interface MiddlewareConfig {
  ref: string
  addr: string
}

export interface ServiceInfo {
  name: string
  bindAddr: string
  service: unknown
  handlers: Record<string, (call: unknown, callback: Function) => unknown>
}

export interface ObjectProto {
  name: string
  path: string
  version: string
}

export interface AuthChallengeRequest {
  realm: string
  domain: string
  scheme: string
  nonce: string
  algorithm: string
  qop: string
  opaque: string
  stale: boolean
}

export interface AuthChallengeResponse {
  realm: string
  domain: string
  scheme: string
  cNonce: string
  nonceCount: number
  response: string
  username: string
  nonce: string
  algorithm: string
  qop: string
  opaque: string
  stale: boolean
  uri: string
  method: string
}

export interface HeaderModifier {
  name: string
  value?: string
  action: "add" | "remove"
}

export interface Route {
  user: string
  host: string
  port: number
  transport: Transport
  registeredOn?: number
  sessionCount?: number
  expires?: number
  edgePortRef: string
  listeningPoint: NetInterface
  labels?: Map<string, string>
  headers?: HeaderModifier[]
}

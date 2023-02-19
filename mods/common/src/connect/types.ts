/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster
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
import { JsonObject } from "pb-util/build"
import { LoadBalancingAlgorithm, Privacy, Transport } from "../types"

export enum Kind {
  AGENT = "agent",
  PEER = "peer",
  NUMBER = "number",
  TRUNK = "trunk",
  DOMAIN = "domain",
  UNKNOWN = "unknown",
  CREDENTIALS = "credentials",
  ACL = "accesscontrollist"
}

export type KindWithoutUnknown = Exclude<Kind, Kind.UNKNOWN>

export enum APIVersion {
  V2DRAFT1 = "v2draft1",
  V2 = "v2"
}

export interface BaseConnectModel {
  apiVersion: string
  ref: string
  name: string
  createdAt?: number
  updatedAt?: number
  extended?: JsonObject
}

export interface AccessControlList extends BaseConnectModel {
  allow: string[]
  deny: string[]
}

export interface Domain extends BaseConnectModel {
  domainUri: string
  accessControlListRef?: string
  accessControlList?: AccessControlList
  egressPolicies?: EgressPolicy[]
}

export interface EgressPolicy {
  numberRef: string
  number?: INumber
  rule: string
}

export interface Agent extends BaseConnectModel {
  username: string
  privacy: Privacy
  enabled: boolean
  domainRef?: string
  domain?: Domain
  credentialsRef?: string
  credentials?: Credentials
}

export interface Credentials extends BaseConnectModel {
  username: string
  password: string
}

export interface INumber extends BaseConnectModel {
  telUrl: string
  aorLink: string
  city: string
  country: string
  countryIsoCode: string
  sessionAffinityHeader: string
  extraHeaders: { name: string; value: string }[]
  trunkRef?: string
  trunk?: Trunk
}

export interface Trunk extends BaseConnectModel {
  sendRegister: boolean
  inboundUri: string
  accessControlListRef?: string
  accessControlList?: AccessControlList
  inboundCredentialsRef?: string
  inboundCredentials?: Credentials
  outboundCredentialsRef?: string
  outboundCredentials?: Credentials
  uris?: TrunkURI[]
}

export interface TrunkURI {
  ref?: string
  trunkRef?: string
  host: string
  port: number
  transport: Transport
  user: string
  weight: number
  priority: number
  enabled: boolean
}

export interface Peer extends BaseConnectModel {
  username: string
  aor: string
  contactAddr: string
  enabled: boolean
  accessControlListRef?: string
  accessControlList?: AccessControlList
  credentialsRef?: string
  credentials?: Credentials
  balancingAlgorithm?: LoadBalancingAlgorithm
  withSessionAffinity?: boolean
}

export type ConnectModel =
  | Agent
  | Peer
  | INumber
  | Trunk
  | Domain
  | Credentials
  | AccessControlList

export type RoutableResourceUnion = Agent | Peer | INumber

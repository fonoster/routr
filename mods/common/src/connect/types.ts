/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
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
import { JsonData, Privacy, Transport } from "../types"

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

export enum APIVersion {
  V2DRAFT1 = "v2draft1",
  V2 = "v2"
}

export interface RoutrResourceBase {
  apiVersion: string
  ref: string
  name: string
  createdAt?: Date
  updatedAt?: Date
  extended?: JsonData
}

export interface AccessControlList extends RoutrResourceBase {
  allow: string[]
  deny: string[]
}

export interface Domain extends RoutrResourceBase {
  domainUri: string
  accessControlList: AccessControlList
  egressPolicies: EgressPolicy[]
}

export interface EgressPolicy {
  number: INumber
  rule: string
}

export interface Agent extends RoutrResourceBase {
  username: string
  privacy: Privacy
  enabled: boolean
  domain?: Domain
  credentials?: Credentials
}

export interface Credentials extends RoutrResourceBase {
  username: string
  password: string
}

export interface INumber extends RoutrResourceBase {
  telUrl: string
  aorLink: string
  city: string
  country: string
  countryIsoCode: string
  sessionAffinityHeader: string
  extraHeaders: { name: string; value: string }[]
  trunk?: Trunk
}

export interface Trunk extends RoutrResourceBase {
  sendRegister: boolean
  inboundUri: string
  accessControlList?: AccessControlList
  inboundCredentials?: Credentials
  outboundCredentials?: Credentials
  uris: TrunkURI[]
}

export interface TrunkURI {
  host: string
  port: number
  transport: Transport
  user: string
  weight: number
  priority: number
  enabled: boolean
}

export interface Peer extends RoutrResourceBase {
  username: string
  aor: string
  contactAddr: string
  enabled: boolean
  accessControlList?: AccessControlList
  credentials?: Credentials
}

export type RoutrResourceUnion =
  | Agent
  | Peer
  | INumber
  | Trunk
  | Domain
  | Credentials
  | AccessControlList

export type RoutableResourceUnion = Agent | Peer | INumber

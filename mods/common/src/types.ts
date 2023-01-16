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
import * as grpc from "@grpc/grpc-js"
import { ServiceDefinition } from "@grpc/proto-loader"
import { JsonArray, JsonValue, Struct } from "pb-util/build"

export type JsonData = Record<
  string,
  string | number | boolean | JsonValue | JsonArray | Struct
>

export enum Method {
  UNKNOWN = "UNKNOWN",
  REGISTER = "REGISTER",
  INVITE = "INVITE",
  MESSAGE = "MESSAGE",
  PUBLISH = "PUBLISH",
  NOTIFY = "NOTIFY",
  SUBSCRIBE = "SUBSCRIBE",
  ACK = "ACK",
  BYE = "BYE",
  CANCEL = "CANCEL",
  OPTIONS = "OPTIONS"
}

export enum Transport {
  TCP = "TCP",
  UDP = "UDP",
  TLS = "TLS",
  SCTP = "SCTP",
  WS = "WS",
  WSS = "WSS"
}

export enum LoadBalancingAlgorithm {
  UNSPECIFIED = "UNSPECIFIED",
  ROUND_ROBIN = "ROUND_ROBIN",
  LEAST_SESSIONS = "LEAST_SESSIONS"
}

export enum ExtraHeader {
  REQUEST_URI = "X-Request-Uri",
  GATEWAY_AUTH = "X-Gateway-Auth",
  EDGEPORT_REF = "X-Edgeport-Ref",
  SESSION_COUNT = "X-Session-Count",
  DOD_NUMBER = "X-DOD-Number",
  DOD_PRIVACY = "X-DOD-Privacy"
}

export enum Privacy {
  NONE = "NONE",
  PRIVATE = "ID"
}

export type AuthorizationAlgorithm = "MD5"

export type AuthorizationScheme = "Digest"

export type Qop = "auth" | "auth-int" | ""

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
  listeningPoints: NetInterface[]
  externalAddrs: string[]
  localnets: string[]
  message: SIPMessage
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
  service: ServiceDefinition
  handlers: Record<
    string,
    (
      call: unknown,
      callback: (error: Error, result: unknown) => void
    ) => unknown
  >
}

export interface ObjectProto {
  name: string
  path: string
  version: string
}

export interface AuthChallengeRequest {
  realm: string
  domain: string
  opaque: string
  stale: boolean
  nonce: string
  scheme: AuthorizationScheme
  algorithm: AuthorizationAlgorithm
  qop: Qop
}

export interface AuthChallengeResponse {
  realm: string
  domain: string
  cNonce: string
  nonce: string
  nonceCount: number
  response: string
  username: string
  opaque: string
  stale: boolean
  uri: string
  method: Method
  scheme: AuthorizationScheme
  algorithm: AuthorizationAlgorithm
  qop: Qop
}

export enum HeaderModifierAction {
  ADD,
  REMOVE
}

export interface HeaderModifier {
  name: string
  value?: string
  action: HeaderModifierAction
}

export interface Route {
  user: string
  host: string
  port: number
  transport: Transport
  registeredOn?: number
  /**
   * Number of active sessions. This is used to determine if a route is
   * overloaded and for load balancing.
   *
   * This value is reported by the endpoint during the REGISTER request,
   * using the X-Session-Count header.
   */
  sessionCount?: number
  expires?: number
  edgePortRef: string
  listeningPoints: NetInterface[]
  localnets: string[]
  externalAddrs: string[]
  // Reserved for future use
  labels?: Map<string, string>
  headers?: HeaderModifier[]
}

export enum ResponseType {
  UNKNOWN = 0,
  TRYING = 1,
  RINGING = 2,
  CALL_IS_BEING_FORWARDED = 3,
  QUEUED = 4,
  SESSION_PROGRESS = 5,
  SUCCESS = 6,
  OK = 7,
  ACCEPTED = 8,
  REDIRECTION = 9,
  MULTIPLE_CHOICES = 10,
  MOVED_PERMANENTLY = 11,
  MOVED_TEMPORARILY = 12,
  USE_PROXY = 13,
  ALTERNATIVE_SERVICE = 14,
  CLIENT_ERROR = 15,
  BAD_REQUEST = 16,
  UNAUTHORIZED = 17,
  PAYMENT_REQUIRED = 18,
  FORBIDDEN = 19,
  NOT_FOUND = 20,
  METHOD_NOT_ALLOWED = 21,
  NOT_ACCEPTABLE = 22,
  PROXY_AUTHENTICATION_REQUIRED = 23,
  REQUEST_TIMEOUT = 24,
  GONE = 25,
  REQUEST_ENTITY_TOO_LARGE = 26,
  REQUEST_URI_TOO_LONG = 27,
  UNSUPPORTED_MEDIA_TYPE = 28,
  UNSUPPORTED_URI_SCHEME = 29,
  BAD_EXTENSION = 30,
  EXTENSION_REQUIRED = 31,
  INTERVAL_TOO_BRIEF = 32,
  TEMPORARILY_UNAVAILABLE = 33,
  CALL_OR_TRANSACTION_DOES_NOT_EXIST = 34,
  LOOP_DETECTED = 35,
  TOO_MANY_HOPS = 36,
  ADDRESS_INCOMPLETE = 37,
  AMBIGUOUS = 38,
  BUSY_HERE = 39,
  REQUEST_TERMINATED = 40,
  NOT_ACCEPTABLE_HERE = 41,
  BAD_EVENT = 42,
  REQUEST_PENDING = 43,
  UNDECIPHERABLE = 44,
  SERVER_ERROR = 45,
  SERVER_INTERNAL_ERROR = 46,
  NOT_IMPLEMENTED = 47,
  BAD_GATEWAY = 48,
  SERVICE_UNAVAILABLE = 49,
  SERVER_TIMEOUT = 50,
  VERSION_NOT_SUPPORTED = 51,
  MESSAGE_TOO_LARGE = 52,
  GLOBAL_ERROR = 53,
  BUSY_EVERYWHERE = 54,
  DECLINE = 55,
  DOES_NOT_EXIST_ANYWHERE = 56,
  SESSION_NOT_ACCEPTABLE = 57
}

export interface WWWAuthenticate {
  realm: string
  domain: string
  nonce: string
  scheme: string
  algorithm: string
  qop: string
  opaque: string
  stale: boolean
}

export interface Authorization {
  realm: string
  scheme: AuthorizationScheme
  nonce: string
  cNonce: string
  nonceCount: number
  response: string
  username: string
  uri: string
  algorithm: AuthorizationAlgorithm
  qop: Qop
  opaque: string
  method?: Method
}

export interface CallID {
  callId: string
}

export interface ContentLength {
  contentLength: number
}

export interface Extension {
  name: string
  value: string
}

export interface Via {
  host: string
  port: number
  branch?: string
  transport: Transport
}

export interface SipURI {
  user?: string
  host: string
  port?: number
  transportParam: Transport
  mAddrParam?: string
  userParam?: string
  ttlParam?: number
  lrParam?: boolean
  methodParam?: string
  secure?: boolean
  userPassword?: string
}

export interface Address {
  uri: SipURI
  displayName?: string
  wildcard?: boolean
}

export interface MaxForwards {
  maxForwards: number
}

// Renamed to avoid conflict with the Route type
export interface RouteHeader {
  address: Address
  parameters?: Record<string, string>
}

export interface RecordRoute {
  address: Address
  parameters?: Record<string, string>
}

export interface From {
  address: Address
  tag: string
  parameters?: Record<string, string>
}

export interface To {
  address: Address
  tag?: string
  parameters?: Record<string, string>
}

export interface Contact {
  address: Address
  expires: number
  qValue: number
}

export interface Expires {
  expires: number
}

export enum MessageType {
  REQUEST = "requestUri",
  RESPONSE = "responseType"
}

export interface SIPMessage {
  messageType: MessageType
  responseType?: ResponseType
  requestUri?: SipURI
  from: From
  to: To
  contact?: Contact
  callId: CallID
  contentLength: ContentLength
  expires?: Expires
  wwwAuthenticate?: WWWAuthenticate
  maxForwards: MaxForwards
  authorization?: Authorization
  extensions: Extension[]
  via: Via[]
  route: RouteHeader[]
  recordRoute: RecordRoute[]
}

export interface GrpcCallback {
  (error: Error | { code: number } | null, response?: unknown): void
}

export interface GrpcCall {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: Record<string, any>
  metadata?: grpc.Metadata
}

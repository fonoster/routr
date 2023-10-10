/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
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
import * as grpc from "@grpc/grpc-js"
import { ServiceDefinition } from "@grpc/proto-loader"
import { JsonArray, JsonValue, Struct } from "pb-util/build"

export type JsonData = Record<
  string,
  string | number | boolean | JsonValue | JsonArray | Struct
>

export const ANONYMOUS = "anonymous"

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
  DOD_PRIVACY = "X-DOD-Privacy",
  CONNECT_TOKEN = "X-Connect-Token"
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
  metadata?: Record<string, string>
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
  postProcessor: boolean
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
  advertisedHost: string
  advertisedPort: number
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
  metadata?: Record<string, string>
}

export enum ResponseType {
  UNKNOWN = "UNKNOWN",
  TRYING = "TRYING",
  RINGING = "RINGING",
  CALL_IS_BEING_FORWARDED = "CALL_IS_BEING_FORWARDED",
  QUEUED = "QUEUED",
  SESSION_PROGRESS = "SESSION_PROGRESS",
  SUCCESS = "SUCCESS",
  OK = "OK",
  ACCEPTED = "ACCEPTED",
  REDIRECTION = "REDIRECTION",
  MULTIPLE_CHOICES = "MULTIPLE_CHOICES",
  MOVED_PERMANENTLY = "MOVED_PERMANENTLY",
  MOVED_TEMPORARILY = "MOVED_TEMPORARILY",
  USE_PROXY = "USE_PROXY",
  ALTERNATIVE_SERVICE = "ALTERNATIVE_SERVICE",
  CLIENT_ERROR = "CLIENT_ERROR",
  BAD_REQUEST = "BAD_REQUEST",
  UNAUTHORIZED = "UNAUTHORIZED",
  PAYMENT_REQUIRED = "PAYMENT_REQUIRED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED",
  NOT_ACCEPTABLE = "NOT_ACCEPTABLE",
  PROXY_AUTHENTICATION_REQUIRED = "PROXY_AUTHENTICATION_REQUIRED",
  REQUEST_TIMEOUT = "REQUEST_TIMEOUT",
  GONE = "GONE",
  REQUEST_ENTITY_TOO_LARGE = "REQUEST_ENTITY_TOO_LARGE",
  REQUEST_URI_TOO_LONG = "REQUEST_URI_TOO_LONG",
  UNSUPPORTED_MEDIA_TYPE = "UNSUPPORTED_MEDIA_TYPE",
  UNSUPPORTED_URI_SCHEME = "UNSUPPORTED_URI_SCHEME",
  BAD_EXTENSION = "BAD_EXTENSION",
  EXTENSION_REQUIRED = "EXTENSION_REQUIRED",
  INTERVAL_TOO_BRIEF = "INTERVAL_TOO_BRIEF",
  TEMPORARILY_UNAVAILABLE = "TEMPORARILY_UNAVAILABLE",
  CALL_OR_TRANSACTION_DOES_NOT_EXIST = "CALL_OR_TRANSACTION_DOES_NOT_EXIST",
  LOOP_DETECTED = "LOOP_DETECTED",
  TOO_MANY_HOPS = "TOO_MANY_HOPS",
  ADDRESS_INCOMPLETE = "ADDRESS_INCOMPLETE",
  AMBIGUOUS = "AMBIGUOUS",
  BUSY_HERE = "BUSY_HERE",
  REQUEST_TERMINATED = "REQUEST_TERMINATED",
  NOT_ACCEPTABLE_HERE = "NOT_ACCEPTABLE_HERE",
  BAD_EVENT = "BAD_EVENT",
  REQUEST_PENDING = "REQUEST_PENDING",
  UNDECIPHERABLE = "UNDECIPHERABLE",
  SERVER_ERROR = "SERVER_ERROR",
  SERVER_INTERNAL_ERROR = "SERVER_INTERNAL_ERROR",
  NOT_IMPLEMENTED = "NOT_IMPLEMENTED",
  BAD_GATEWAY = "BAD_GATEWAY",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  SERVER_TIMEOUT = "SERVER_TIMEOUT",
  VERSION_NOT_SUPPORTED = "VERSION_NOT_SUPPORTED",
  MESSAGE_TOO_LARGE = "MESSAGE_TOO_LARGE",
  GLOBAL_ERROR = "GLOBAL_ERROR",
  BUSY_EVERYWHERE = "BUSY_EVERYWHERE",
  DECLINE = "DECLINE",
  DOES_NOT_EXIST_ANYWHERE = "DOES_NOT_EXIST_ANYWHERE",
  SESSION_NOT_ACCEPTABLE = "SESSION_NOT_ACCEPTABLE"
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
  received?: string
  rPortFlag?: boolean
  rPort?: number
  ttl?: number
  mAddr?: string
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
  body?: string
}

export interface GrpcCallback {
  (error: Error | { code: number } | null, response?: unknown): void
}

export interface GrpcCall {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: Record<string, any>
  metadata?: grpc.Metadata
}

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
import {
  MessageRequest,
  Transport,
  CommonTypes as CT,
  Helper,
  NetInterface,
  Method,
  Route
} from "@routr/common"
import { IpUtils } from "@routr/common"
import { DEFAULT_EXPIRES, getTargetExpires } from "./target"

export const isTypeResponse = (request: MessageRequest): boolean =>
  request.message.messageType === CT.MessageType.RESPONSE

export const isTypeRequest = (request: MessageRequest): boolean =>
  !isTypeResponse(request)

export const getEdgeInterface = (nets: {
  listeningPoints: NetInterface[]
  endpointIntf: NetInterface
  localnets: string[]
  externalAddrs: string[]
}): NetInterface => {
  const { listeningPoints, endpointIntf, localnets, externalAddrs } = nets
  const localnetIp = IpUtils.getLocalnetIp(localnets, endpointIntf.host)
  const host = localnetIp ?? externalAddrs[0]
  const lp = Helper.getListeningPoint(listeningPoints, endpointIntf.transport)

  if (!localnetIp && externalAddrs.length === 0) {
    throw new Error(
      `unable to find a valid interface for host ${endpointIntf.host} and transport ${lp.transport}`
    )
  }

  if (localnetIp && lp.host !== "0.0.0.0" && lp.host !== host) {
    throw new Error(
      `listening point host ${lp.host} does not match interface host ${host}`
    )
  }

  return {
    host,
    port: lp.port,
    transport: lp.transport
  }
}

export const hasSDP = (request: MessageRequest) =>
  request.message.body?.length > 0

export const isOk = (request: MessageRequest) =>
  request.message.responseType === CT.ResponseType.OK

export const isRinging = (request: MessageRequest) =>
  request.message.responseType === CT.ResponseType.RINGING

export const isWebRTC = (transport: Transport) =>
  transport === Transport.WS || transport === Transport.WSS

export const isInviteWithSDP = (request: MessageRequest) =>
  isTypeRequest(request) && hasSDP(request) && request.method === Method.INVITE

export const isAckWithSDP = (request: MessageRequest) =>
  isTypeRequest(request) && hasSDP(request) && request.method === Method.ACK

export const isInviteOrAckWithSDP = (request: MessageRequest) =>
  isInviteWithSDP(request) || isAckWithSDP(request)

export const isResponseWithSDP = (request: MessageRequest) =>
  isTypeResponse(request) && hasSDP(request)

export const isOkOrRingingWithSDP = (request: MessageRequest) =>
  isTypeResponse(request) &&
  hasSDP(request) &&
  (isOk(request) || isRinging(request))

export const isBye = (request: MessageRequest) =>
  isTypeRequest(request) && request.method === Method.BYE

/**
 * The address the request came from: the top Via's received value, which the
 * SIP stack sets when the packet's source differs from the Via host (RFC 3261
 * section 18.2.1), or the Via host otherwise. A processor checks it against
 * the peer EdgePorts it trusts to decide fromPeer, and passes it as
 * addSelfRecordRouteFromPeer's peerSource. Take it before an alteration adds
 * a Via: that Via becomes the top one.
 *
 * @param {MessageRequest} request - the request
 * @return {string} the address, "" without a Via
 */
export const sourceAddress = (request: MessageRequest): string => {
  const via = request.message.via?.[0]
  if (!via) return ""
  return via.received || via.host || ""
}

const transportOf = (name?: string): Transport => {
  const upper = name?.toUpperCase()
  return Object.values(Transport).includes(upper as Transport)
    ? (upper as Transport)
    : Transport.UDP
}

const sessionCountOf = (request: MessageRequest): number => {
  const value = request.message.extensions?.find(
    (ext: CT.Extension) => ext.name.toLowerCase() === "x-session-count"
  )?.value
  if (value === undefined || value === null || value === "") return -1
  const n = parseInt(value.trim(), 10)
  return isNaN(n) ? 0 : n
}

/**
 * The route of a request a peer EdgePort forwarded (one carrying
 * X-Edgeport-Ref from a source the processor trusts): the peer pointed the
 * Request-URI at the endpoint, so the route is built from it, as seen from
 * this EdgePort, with the top Via's host as the advertised host. The EdgePort
 * drops the Request-URI's parameters, so with no transport there the route
 * takes the sender's, the one the peer sent on. Connect's
 * createRouteFromLastMessage with its transport override.
 *
 * @param {MessageRequest} request - the request from the peer EdgePort
 * @param {number} defaultExpires - the expiry when the request names none
 * @return {Route} the route
 */
export const createRouteFromPeer = (
  request: MessageRequest,
  defaultExpires: number = DEFAULT_EXPIRES
): Route => {
  const uri = request.message.requestUri
  const via = request.message.via?.[0]
  return {
    edgePortRef: request.edgePortRef,
    user: uri.user,
    host: uri.host,
    port: uri.port,
    advertisedHost: via?.host,
    advertisedPort: via?.port,
    transport: uri.transportParam
      ? transportOf(uri.transportParam)
      : request.sender.transport,
    registeredOn: Date.now(),
    sessionCount: sessionCountOf(request),
    expires: getTargetExpires(request, defaultExpires),
    listeningPoints: request.listeningPoints,
    localnets: request.localnets,
    externalAddrs: request.externalAddrs
  }
}

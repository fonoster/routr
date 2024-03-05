/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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
import {
  MessageRequest,
  Transport,
  CommonTypes as CT,
  Helper,
  NetInterface,
  Method
} from "@routr/common"
import { IpUtils } from "@routr/common"

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

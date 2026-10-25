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
/* eslint-disable require-jsdoc */
import { CommonTypes as CT, MessageRequest } from "@routr/common"
import { Helper as H } from "@routr/processor"
import { Direction, RTPEProfiles } from "./types"
import { DEFAULT_PROFILES, profileNameFor } from "./profiles"

export function getDirectionFromResponse(request: MessageRequest) {
  const srcTransport = request.sender.transport
  const dstTransport = request.message.via[0].transport
  return getDirection(srcTransport, dstTransport)
}

// Will should be able to determine the direction with Request-URI and Route header
// WARNING: Seems like a duplicated code
export function getDirectionFromRequest(request: MessageRequest) {
  const srcTransport = request.sender.transport
  const dstTransport = request.message.via[0].transport
  return getDirection(srcTransport, dstTransport)
}

export function getDirection(
  srcTransport: CT.Transport,
  dstTransport: CT.Transport
) {
  if (H.isWebRTC(srcTransport) && H.isWebRTC(dstTransport)) {
    return Direction.WEB_TO_WEB
  }

  if (H.isWebRTC(srcTransport) && !H.isWebRTC(dstTransport)) {
    return Direction.WEB_TO_PHONE
  }

  if (!H.isWebRTC(srcTransport) && H.isWebRTC(dstTransport)) {
    return Direction.PHONE_TO_WEB
  }

  return Direction.PHONE_TO_PHONE
}

// A phone leg reached over TLS, which is how a carrier that requires secure
// trunking is configured. SRTP follows the transport: such a leg gets SDES-SRTP.
export const isSecurePhone = (transport: CT.Transport) =>
  transport?.toUpperCase() === CT.Transport.TLS

// The leg a message is being sent to. For a request the EdgePort has already
// put its own Via on top, facing the next hop; for a response the top Via is
// the party the response goes back to.
export const getDestinationTransport = (request: MessageRequest) =>
  request.message.via[0]?.transport

// The RTPEngine parameters for the leg the message is sent to. With
// secureCallee the phone leg negotiates SDES-SRTP (RTP/SAVP) instead of plain
// RTP; RTPEngine then encrypts toward the carrier and bridges to the other leg.
// The profiles default to the shipped ones; the runner passes the merged set
// when a configuration file is present.
export const getRTPEParamsByDirection = (
  dir: Direction,
  secureCallee = false,
  profiles: RTPEProfiles = DEFAULT_PROFILES
) => profiles[profileNameFor(dir, secureCallee)]

// The RTPEngine parameters for a message, from its direction and the transport
// of the leg it is sent to.
export const getRTPEParams = (
  request: MessageRequest,
  direction: Direction,
  profiles: RTPEProfiles = DEFAULT_PROFILES
) =>
  getRTPEParamsByDirection(
    direction,
    isSecurePhone(getDestinationTransport(request)),
    profiles
  )

export const callInvolvesWebRTC = (direction: Direction) =>
  direction == Direction.WEB_TO_PHONE || direction == Direction.PHONE_TO_WEB

export const shouldNotHandleRequest = (req: MessageRequest) =>
  !(
    H.isInviteOrAckWithSDP(req) ||
    H.isOkOrRingingWithSDP(req) ||
    H.isRinging(req) ||
    H.isBye(req)
  )

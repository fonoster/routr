/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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
import { Direction } from "./types"

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

export function getRTPEParamsByDirection(dir: Direction) {
  switch (dir) {
    case Direction.WEB_TO_WEB:
      return {
        ICE: "force",
        SDES: ["off"],
        flags: ["trust-address", "replace-origin", "replace-session-connection"]
      }
    case Direction.WEB_TO_PHONE:
      return {
        "transport-protocol": "RTP/AVP",
        "rtcp-mux": "demux",
        ICE: "remove",
        flags: ["trust-address", "replace-origin", "replace-session-connection"]
      }
    case Direction.PHONE_TO_WEB:
      return {
        "transport-protocol": "UDP/TLS/RTP/SAVPF",
        "rtcp-mux": "require",
        ICE: "force",
        SDES: ["off"],
        flags: [
          "trust-address",
          "replace-origin",
          "replace-session-connection",
          "generate-mid"
        ]
      }
    case Direction.PHONE_TO_PHONE:
      return {
        "transport-protocol": "RTP/AVP",
        "rtcp-mux": "demux",
        ICE: "remove",
        flags: ["trust-address", "replace-origin", "replace-session-connection"]
      }
  }
}

export const callInvolvesWebRTC = (direction: Direction) =>
  direction == Direction.WEB_TO_PHONE || direction == Direction.PHONE_TO_WEB

export const shouldNotHandleRequest = (req: MessageRequest) =>
  !(
    H.isInviteOrAckWithSDP(req) ||
    H.isOkOrRingingWithSDP(req) ||
    H.isRinging(req) ||
    H.isBye(req)
  )

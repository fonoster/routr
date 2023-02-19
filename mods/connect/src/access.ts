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
import { getLogger } from "@fonoster/logger"
import {
  Auth,
  MessageRequest,
  CommonTypes as CT,
  CommonConnect as CC,
  IpUtils
} from "@routr/common"
import { RoutingDirection } from "./types"

const logger = getLogger({ service: "connect", filePath: __filename })

export const checkAccess = async (accessRequest: {
  apiClient: CC.APIClient
  request: MessageRequest
  caller: CC.RoutableResourceUnion
  callee: CC.RoutableResourceUnion
  routingDirection: RoutingDirection
}): Promise<Record<string, unknown>> => {
  const { apiClient, request, caller, callee, routingDirection } = accessRequest
  switch (routingDirection) {
    case RoutingDirection.PEER_TO_PSTN:
    case RoutingDirection.AGENT_TO_AGENT:
    case RoutingDirection.AGENT_TO_PSTN:
      return checkAgentOrPeerAccess(request, caller as CC.RoutableResourceUnion)
    case RoutingDirection.FROM_PSTN:
      return checkAccessFromPSTN(apiClient, request, callee as CC.INumber)
    case RoutingDirection.UNKNOWN:
      return Auth.createForbideenResponse()
  }
}

export const checkAgentOrPeerAccess = async (
  request: MessageRequest,
  caller: CC.RoutableResourceUnion
) => {
  // Calculate and return challenge
  if (request.message.authorization) {
    const auth = { ...request.message.authorization }
    auth.method = request.method
    const credentials = (caller as CC.Agent).credentials

    // Calculate response and compare with the one send by the endpoint
    const calcRes = Auth.calculateAuthResponse(
      auth as CT.AuthChallengeResponse,
      {
        username: credentials?.username,
        secret: credentials?.password
      }
    )

    if (calcRes !== auth.response) {
      return Auth.createUnauthorizedResponse(request.message.requestUri.host)
    }
  } else {
    return Auth.createUnauthorizedResponse(request.message.requestUri.host)
  }
}

export const checkAccessFromPSTN = async (
  apiClient: CC.APIClient,
  request: MessageRequest,
  callee: CC.INumber
) => {
  // Get the Trunk associated with the SIP URI
  const trunk = (
    await apiClient.trunks.findBy({
      fieldName: "inboundUri",
      fieldValue: request.message.requestUri.host
    })
  ).items[0]

  // If the Trunk or Number doesn't exist reject the call
  if (!callee || !trunk) {
    return Auth.createForbideenResponse()
  }

  if (callee.trunk.ref !== trunk.ref) {
    return Auth.createForbideenResponse()
  }

  // Verify that the IP is whitelisted which means getting the access control list for the trunk
  if (trunk.accessControlList) {
    try {
      const allow = trunk.accessControlList.allow.filter((net: string) => {
        return IpUtils.hasIp(net, request.sender.host)
      })[0]

      if (!allow) {
        return Auth.createUnauthorizedResponseWithoutChallenge()
      }
    } catch (e) {
      logger.error(e)
      return Auth.createServerInternalErrorResponse()
    }
  }

  // If the Trunk has a User/Password we must verify that the User/Password are valid
  if (trunk.inboundCredentials) {
    // Calculate and return challenge
    if (request.message.authorization) {
      const auth = { ...request.message.authorization }
      auth.method = request.method

      // Calculate response and compare with the one send by the endpoint
      const calcRes = Auth.calculateAuthResponse(
        auth as CT.AuthChallengeResponse,
        {
          username: trunk.inboundCredentials.username,
          secret: trunk.inboundCredentials.password
        }
      )

      if (calcRes !== auth.response) {
        return Auth.createUnauthorizedResponse(request.message.requestUri.host)
      }
    } else {
      return Auth.createUnauthorizedResponse(request.message.requestUri.host)
    }
  }
}

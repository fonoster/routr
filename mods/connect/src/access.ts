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
import { getLogger } from "@fonoster/logger"
import {
  Auth,
  MessageRequest,
  CommonTypes as CT,
  CommonConnect as CC,
  IpUtils
} from "@routr/common"
import { RoutingDirection } from "./types"
import { findTrunkByRequestURI } from "./utils"

const logger = getLogger({ service: "connect", filePath: __filename })

export const checkAccess = async (accessRequest: {
  dataAPI: CC.DataAPI
  request: MessageRequest
  caller: CC.Resource
  callee: CC.Resource
  routingDirection: RoutingDirection
}): Promise<Record<string, unknown>> => {
  const { dataAPI, request, caller, callee, routingDirection } = accessRequest
  switch (routingDirection) {
    case RoutingDirection.PEER_TO_PSTN:
    case RoutingDirection.AGENT_TO_AGENT:
    case RoutingDirection.AGENT_TO_PSTN:
      return checkAgentOrPeerAccess(dataAPI, request, caller)
    case RoutingDirection.FROM_PSTN:
      return checkAccessFromPSTN(dataAPI, request, callee)
    case RoutingDirection.UNKNOWN:
      return Auth.createForbideenResponse()
  }
}

export const checkAgentOrPeerAccess = async (
  dataAPI: CC.DataAPI,
  request: MessageRequest,
  caller: CC.Resource
) => {
  // Calculate and return challenge
  if (request.message.authorization) {
    const auth = { ...request.message.authorization }
    auth.method = request.method
    const credentials = await dataAPI.get(caller.spec.credentialsRef)

    // Calculate response and compare with the one send by the endpoint
    const calcRes = Auth.calculateAuthResponse(
      auth as CT.AuthChallengeResponse,
      {
        username: credentials?.spec.credentials.username,
        secret: credentials?.spec.credentials.password
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
  dataAPI: CC.DataAPI,
  request: MessageRequest,
  callee: CC.Resource
) => {
  // Get the Trunk associated with the SIP URI
  const trunk = await findTrunkByRequestURI(
    dataAPI,
    request.message.requestUri.host
  )

  // If the Trunk or Number doesn't exist reject the call
  if (!callee || !trunk) {
    return Auth.createForbideenResponse()
  }

  if (callee.spec.trunkRef !== trunk.ref) {
    return Auth.createForbideenResponse()
  }

  // Verify that the IP is whitelisted which means getting the access control list for the trunk
  if (trunk.spec.inbound?.accessControlListRef) {
    try {
      const acl = await dataAPI.get(trunk.spec.inbound.accessControlListRef)

      if (!acl) {
        // Should never happen since the ACL is required
        return Auth.createServerInternalErrorResponse()
      }

      const allow = acl.spec.accessControlList.allow.filter((net: string) => {
        return IpUtils.hasIp(net, request.sender.host)
      })[0]

      if (!allow) {
        // TODO: Replace with Unauthorized
        return Auth.createUnauthorizedResponseWithoutChallenge()
      }
    } catch (e) {
      logger.error(e)
    }
  }

  // If the Trunk has a User/Password we must verify that the User/Password are valid
  if (trunk.spec.inbound?.credentialsRef) {
    const credentials = await dataAPI.get(trunk.spec.inbound.credentialsRef)
    if (!credentials) {
      // Should never happen since the Credentials is required
      return Auth.createServerInternalErrorResponse()
    }

    // Calculate and return challenge
    if (request.message.authorization) {
      const auth = { ...request.message.authorization }
      auth.method = request.method

      // Calculate response and compare with the one send by the endpoint
      const calcRes = Auth.calculateAuthResponse(
        auth as CT.AuthChallengeResponse,
        {
          username: credentials.spec.credentials.username,
          secret: credentials.spec.credentials.password
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

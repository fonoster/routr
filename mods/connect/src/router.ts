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
import { RoutingDirection } from "./types"
import {
  CommonConnect as CC,
  CommonTypes as CT,
  HeaderModifier,
  Route
} from "@routr/common"
import {
  createPAssertedIdentity,
  createRemotePartyId,
  createTrunkAuthentication,
  findResource,
  getRoutingDirection,
  getTrunkURI
} from "./utils"
import { MessageRequest, Target as T } from "@routr/processor"
import { NotRoutesFoundForAOR, ILocationService } from "@routr/location"
import { UnsuportedRoutingError } from "./errors"
import { getLogger } from "@fonoster/logger"

const logger = getLogger({ service: "connect", filePath: __filename })

const getSIPURI = (uri: { user?: string; host: string }) =>
  `sip:${uri.user}@${uri.host}`

// eslint-disable-next-line require-jsdoc
export function router(location: ILocationService, dataAPI: CC.DataAPI) {
  return async (req: MessageRequest): Promise<Route> => {
    const fromURI = req.message.from.address.uri
    const requestURI = req.message.requestUri

    logger.verbose(
      "routing request from: " +
        getSIPURI(fromURI) +
        ", to: " +
        getSIPURI(requestURI),
      { fromURI: getSIPURI(fromURI), requestURI: getSIPURI(requestURI) }
    )

    const caller = await findResource(dataAPI, fromURI.host, fromURI.user)
    const callee = await findResource(dataAPI, requestURI.host, requestURI.user)
    const routingDir = getRoutingDirection(caller, callee)

    switch (routingDir) {
      case RoutingDirection.AGENT_TO_PSTN:
        return await toPSTN(dataAPI, req, caller, requestURI.user)
      case RoutingDirection.AGENT_TO_AGENT:
        return agentToAgent(location, req)
      case RoutingDirection.FROM_PSTN:
        return await fromPSTN(location, dataAPI, callee)
      default:
        throw new UnsuportedRoutingError(routingDir)
    }
  }
}

// eslint-disable-next-line require-jsdoc
async function agentToAgent(
  location: ILocationService,
  req: MessageRequest
): Promise<Route> {
  return (await location.findRoutes({ aor: T.getTargetAOR(req) }))[0]
}

/**
 * From PSTN routing.
 *
 * @param {ILocationService} location - Location service
 * @param {uknown} _
 * @param {Resource} callee - The callee
 * @return {Promise<Route>}
 */
async function fromPSTN(
  location: ILocationService,
  _: unknown,
  callee: CC.Resource
): Promise<Route> {
  const route = (
    await location.findRoutes({
      aor: callee.spec.location.aorLink
    })
  )[0]

  if (!route) {
    throw new NotRoutesFoundForAOR(callee.spec.location.aorLink)
  }

  if (!route.headers) route.headers = []

  callee.spec.location.props?.forEach(
    (prop: { name: string; value: string }) => {
      const p: HeaderModifier = {
        name: prop.name,
        value: prop.value,
        action: CT.HeaderModifierAction.ADD
      }
      route.headers.push(p)
    }
  )

  return route
}

// eslint-disable-next-line require-jsdoc
async function toPSTN(
  dataAPI: CC.DataAPI,
  req: MessageRequest,
  caller: CC.Resource,
  calleeNumber: string
): Promise<Route> {
  const domain = await dataAPI.get(caller.spec.domainRef)

  // Look for Number in domain that matches regex callee
  const policy = domain.spec.context.egressPolicies?.find(
    (policy: { rule: string }) => {
      const regex = new RegExp(policy.rule)
      return regex.test(calleeNumber)
    }
  )

  const number = await dataAPI.get(policy?.numberRef)

  const trunk = await dataAPI.get(number?.spec.trunkRef)

  if (!domain.spec.context.egressPolicies) {
    // TODO: Create custom error
    throw new Error(`no egress policy found for Domain ref: ${domain.ref}`)
  }

  if (!trunk) {
    // TODO: Create custom error
    throw new Error(`no trunk associated with Number ref: ${number?.ref}`)
  }

  const uri = getTrunkURI(trunk)

  return {
    user: uri.user,
    host: uri.host,
    port: uri.port,
    transport: uri.transport,
    edgePortRef: req.edgePortRef,
    listeningPoints: req.listeningPoints,
    localnets: req.localnets,
    externalAddrs: req.externalAddrs,
    headers: [
      // TODO: Find a more deterministic way to re-add the Privacy header
      {
        name: "Privacy",
        action: CT.HeaderModifierAction.REMOVE
      },
      {
        name: "Privacy",
        value:
          caller.spec.privacy?.toLowerCase() === CT.Privacy.PRIVATE
            ? CT.Privacy.PRIVATE
            : CT.Privacy.NONE,
        action: CT.HeaderModifierAction.ADD
      },
      createRemotePartyId(trunk, number),
      createPAssertedIdentity(req, trunk, number),
      await createTrunkAuthentication(dataAPI, trunk)
    ]
  }
}

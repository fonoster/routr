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
import { ROUTING_DIRECTION } from "./types"
import { HeaderModifier, Route } from "@routr/common"
import {
  createPAssertedIdentity,
  createRemotePartyId,
  createTrunkAuthentication,
  findResource,
  getRoutingDirection,
  getTrunkURI
} from "./utils"
import { MessageRequest, Target as T } from "@routr/processor"
import { UnsuportedRoutingError } from "./errors"
import { NotRoutesFoundForAOR } from "@routr/location"
import { ILocationService } from "@routr/location"
import { getLogger } from "@fonoster/logger"
import { CommonConnect as CC } from "@routr/common"

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
      case ROUTING_DIRECTION.AGENT_TO_PSTN:
        return await toPSTN(dataAPI, req, caller)
      case ROUTING_DIRECTION.AGENT_TO_AGENT:
        return agentToAgent(location, req)
      case ROUTING_DIRECTION.FROM_PSTN:
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
        action: "add"
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
  caller: CC.Resource
): Promise<Route> {
  const domain = await dataAPI.get(caller.spec.domainRef)
  const number = await dataAPI.get(domain.spec.context.egressPolicy?.numberRef)
  const trunk = await dataAPI.get(number?.spec.trunkRef)

  if (!domain.spec.context.egressPolicy) {
    // TODO: Create custom error
    throw new Error(
      "no egress policy found for Domain ref" + domain.metadata.ref
    )
  }

  if (!trunk) {
    // TODO: Create custom error
    throw new Error(
      "no trunk associated with Number ref: " + number.metadata.ref
    )
  }

  const uri = getTrunkURI(trunk)

  return {
    user: uri.user,
    host: uri.host,
    port: uri.port,
    transport: uri.transport,
    edgePortRef: req.edgePortRef,
    listeningPoint: req.listeningPoint,
    headers: [
      createRemotePartyId(trunk, number),
      createPAssertedIdentity(req, trunk, number),
      await createTrunkAuthentication(dataAPI, trunk)
    ]
  }
}

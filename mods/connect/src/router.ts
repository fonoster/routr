/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
import { RoutingDirection } from "./types"
import {
  Auth,
  CommonConnect as CC,
  CommonTypes as CT,
  HeaderModifier,
  Route,
  Method,
  Verifier
} from "@routr/common"
import {
  createPAssertedIdentity,
  createRemotePartyId,
  createTrunkAuthentication,
  findDomain,
  findNumberByTelUrl,
  findResource,
  getRoutingDirection,
  getSIPURI,
  getTrunkURI,
  getVerifierImpl,
  hasXConnectObjectHeader
} from "./utils"
import { MessageRequest, Target as T, Extensions as E } from "@routr/processor"
import { ILocationService, Backend } from "@routr/location"
import { UnsuportedRoutingError } from "./errors"
import { getLogger } from "@fonoster/logger"
import { checkAccess } from "./access"

const logger = getLogger({ service: "connect", filePath: __filename })
const jwtVerifier = getVerifierImpl()

// eslint-disable-next-line require-jsdoc
export function router(location: ILocationService, apiClient: CC.APIClient) {
  return async (
    request: MessageRequest
  ): Promise<
    { route: Route; direction: RoutingDirection } | Record<string, unknown>
  > => {
    const fromURI = request.message.from.address.uri
    const requestURI = request.message.requestUri

    let caller
    let callee

    if (hasXConnectObjectHeader(request)) {
      const connectToken = E.getHeaderValue(
        request,
        CT.ExtraHeader.CONNECT_TOKEN
      )

      try {
        if (!jwtVerifier) {
          return Auth.createServerInternalErrorResponse()
        }

        const payload = (await jwtVerifier.verify(
          connectToken
        )) as Verifier.VerifyResponse
        const domain = await findDomain(apiClient, payload.domain)

        if (!payload.allowedMethods.includes(Method.INVITE)) {
          return Auth.createForbideenResponse()
        }

        caller = {
          apiVersion: CC.APIVersion.V2,
          ref: payload.ref,
          name: request.message.from.address.displayName ?? CT.ANONYMOUS,
          domain: domain,
          domainRef: payload.domainRef,
          username: CT.ANONYMOUS,
          privacy: E.getHeaderValue(request, "Privacy"),
          enabled: true
        } as CC.Agent

        callee = (
          await apiClient.peers.findBy({
            fieldName: "aor",
            fieldValue: payload.aorLink
          })
        ).items[0]

        // Experimental support for Ephemeral Agents when calling agent-to-agent
        if (!callee) {
          callee = {
            apiVersion: CC.APIVersion.V2,
            ref: CT.ANONYMOUS,
            name: CT.ANONYMOUS,
            domain: domain,
            domainRef: payload.domainRef,
            username: CT.ANONYMOUS,
            privacy: E.getHeaderValue(request, "Privacy"),
            enabled: true
          } as CC.Agent
        }
      } catch (e) {
        logger.verbose("unable to validate connect token", {
          originalError: e.message
        })
        return Auth.createForbideenResponse()
      }
    } else {
      caller = await findResource(apiClient, fromURI.host, fromURI.user)
      callee = await findResource(apiClient, requestURI.host, requestURI.user)
    }

    const routingDirection = getRoutingDirection(caller, callee)

    logger.verbose(
      "routing request from: " +
        getSIPURI(fromURI) +
        ", to: " +
        getSIPURI(requestURI),
      {
        fromURI: getSIPURI(fromURI),
        requestURI: getSIPURI(requestURI),
        routingDirection
      }
    )

    if (
      !hasXConnectObjectHeader(request) &&
      request.method === CT.Method.INVITE
    ) {
      const failedCheck = await checkAccess({
        apiClient,
        request,
        caller,
        callee,
        routingDirection
      })

      if (failedCheck) {
        return failedCheck
      }
    }

    const result = (
      direction: RoutingDirection,
      route: Route,
      extended: Record<string, unknown>
    ) =>
      route
        ? {
            direction,
            route: {
              ...route,
              metadata: extended
            }
          }
        : {
            direction,
            route: null
          }

    // We add metadata to the route object so we can use it later to link to an account
    switch (routingDirection) {
      case RoutingDirection.AGENT_TO_AGENT: {
        const route = await agentToAgent(location, request)
        return result(routingDirection, route, caller.extended)
      }
      case RoutingDirection.AGENT_TO_PEER: {
        const route = await agentToPeer(location, callee as CC.Peer, request)
        return result(routingDirection, route, caller.extended)
      }
      case RoutingDirection.AGENT_TO_PSTN: {
        const route = await agentToPSTN(
          request,
          caller as CC.Agent,
          requestURI.user
        )
        return result(routingDirection, route, caller.extended)
      }
      case RoutingDirection.FROM_PSTN: {
        const route = await fromPSTN(
          apiClient,
          location,
          callee as CC.INumber,
          request
        )
        return result(routingDirection, route, callee.extended)
      }
      case RoutingDirection.PEER_TO_PSTN:
        return result(
          routingDirection,
          await peerToPSTN(apiClient, request),
          callee?.extended
        )
      default:
        throw new UnsuportedRoutingError(routingDirection)
    }
  }
}

// eslint-disable-next-line require-jsdoc
async function agentToAgent(
  location: ILocationService,
  req: MessageRequest
): Promise<Route> {
  return (
    await location.findRoutes({ aor: T.getTargetAOR(req), callId: req.ref })
  )[0]
}

/**
 * From PSTN routing.
 *
 * @param {APIClient} apiClient - API client
 * @param {ILocationService} location - Location service
 * @param {Resource} callee - The callee
 * @param {MessageRequest} req - The request
 * @return {Promise<Route>}
 */
async function fromPSTN(
  apiClient: CC.APIClient,
  location: ILocationService,
  callee: CC.INumber,
  req: MessageRequest
): Promise<Route> {
  const sessionAffinityRef = E.getHeaderValue(req, callee.sessionAffinityHeader)
  let backend: Backend

  const peer = (
    await apiClient.peers.findBy({
      fieldName: "aor",
      fieldValue: callee.aorLink
    })
  ).items[0]

  if (peer) {
    backend = {
      balancingAlgorithm: peer.balancingAlgorithm,
      withSessionAffinity: peer.withSessionAffinity
    }
  }

  const route = (
    await location.findRoutes({
      aor: callee.aorLink,
      callId: req.ref,
      sessionAffinityRef,
      backend
    })
  )[0]

  if (!route) {
    return null
  }

  if (!route.headers) route.headers = []

  callee.extraHeaders?.forEach((prop: { name: string; value: string }) => {
    const p: HeaderModifier = {
      name: prop.name,
      value: prop.value,
      action: CT.HeaderModifierAction.ADD
    }
    route.headers.push(p)
  })

  return route
}

// eslint-disable-next-line require-jsdoc
async function agentToPSTN(
  req: MessageRequest,
  agent: CC.Agent,
  calleeNumber: string
): Promise<Route> {
  if (!agent.domain?.egressPolicies) {
    // TODO: Create custom error
    throw new Error(
      `no egress policy found for Domain ref: ${agent.domain.ref}`
    )
  }

  // Look for Number in domain that matches regex callee
  const policy = agent.domain.egressPolicies.find(
    (policy: { rule: string }) => {
      const regex = new RegExp(policy.rule)
      return regex.test(calleeNumber)
    }
  )

  const trunk = policy.number?.trunk

  if (!trunk) {
    // This should never happen
    throw new Error(
      `no trunk associated with Number ref: ${policy.number?.ref}`
    )
  }

  const via = req.message.via[0]
  const uri = getTrunkURI(trunk)

  return {
    user: uri.user,
    host: uri.host,
    port: uri.port,
    advertisedHost: via.host,
    advertisedPort: via.port,
    transport: uri.transport?.toUpperCase() as CT.Transport,
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
          agent.privacy?.toUpperCase() === CT.Privacy.PRIVATE
            ? CT.Privacy.PRIVATE.toLowerCase()
            : CT.Privacy.NONE.toLowerCase(),
        action: CT.HeaderModifierAction.ADD
      },
      createRemotePartyId(trunk, policy.number),
      createPAssertedIdentity(req, trunk, policy.number),
      await createTrunkAuthentication(trunk)
    ]
  }
}

// eslint-disable-next-line require-jsdoc
async function agentToPeer(
  location: ILocationService,
  callee: CC.Peer,
  req: MessageRequest
) {
  const backend: Backend = {
    balancingAlgorithm: callee.balancingAlgorithm,
    withSessionAffinity: callee.withSessionAffinity
  }

  return (
    await location.findRoutes({
      aor: callee.aor,
      callId: req.ref,
      backend
    })
  )[0]
}

// eslint-disable-next-line require-jsdoc
async function peerToPSTN(
  apiClient: CC.APIClient,
  req: MessageRequest
): Promise<Route> {
  const numberTel = E.getHeaderValue(req, CT.ExtraHeader.DOD_NUMBER)
  const privacy = E.getHeaderValue(req, CT.ExtraHeader.DOD_PRIVACY)
  const number = await findNumberByTelUrl(apiClient, `tel:${numberTel}`)

  if (!number) {
    throw new Error(`no Number found for tel: ${numberTel}`)
  }

  if (!number.trunk) {
    // TODO: Create custom error
    throw new Error(`no trunk associated with Number ref: ${number.ref}`)
  }

  const via = req.message.via[0]
  const uri = getTrunkURI(number.trunk)

  return {
    user: uri.user,
    host: uri.host,
    port: uri.port,
    advertisedHost: via.host,
    advertisedPort: via.port,
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
          privacy?.toLocaleLowerCase() === CT.Privacy.PRIVATE
            ? CT.Privacy.PRIVATE.toLowerCase()
            : CT.Privacy.NONE.toLowerCase(),
        action: CT.HeaderModifierAction.ADD
      },
      createRemotePartyId(number.trunk, number),
      createPAssertedIdentity(req, number.trunk, number),
      await createTrunkAuthentication(number.trunk)
    ]
  }
}

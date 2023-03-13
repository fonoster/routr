/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
import { Helper as H } from "@routr/location"
import { tailor } from "./tailor"
import {
  Alterations as A,
  Extensions as E,
  MessageRequest,
  Response,
  Target as T
} from "@routr/processor"
import { pipe } from "fp-ts/function"
import { router } from "./router"
import { ILocationService } from "@routr/location"
import {
  Auth,
  CommonConnect as CC,
  CommonTypes as CT,
  Environment,
  Method
} from "@routr/common"
import { findResource, getVerifierImpl, hasXConnectObjectHeader } from "./utils"
import { getLogger } from "@fonoster/logger"

const logger = getLogger({ service: "connect", filePath: __filename })

const enforceE164 = A.enforceE164(
  Environment.ENFORCE_E164,
  Environment.ENFORCE_E164_WITH_MOBILE_PREFIX
)

const jwtVerifier = getVerifierImpl()

export const handleRegister = (
  apiClient: CC.APIClient,
  location: ILocationService
) => {
  return async (request: MessageRequest, res: Response) => {
    // Calculate and return challenge
    if (request.message.authorization) {
      const auth = { ...request.message.authorization }
      auth.method = request.method
      const fromURI = request.message.from.address.uri
      const peerOrAgent = await findResource(
        apiClient,
        fromURI.host,
        fromURI.user
      )

      if (!peerOrAgent) {
        return res.send(Auth.createForbideenResponse())
      }

      const credentials = (
        peerOrAgent as { credentials: { username: string; password: string } }
      ).credentials

      // Calculate response and compare with the one send by the endpoint
      const calcRes = Auth.calculateAuthResponse(
        auth as CT.AuthChallengeResponse,
        {
          username: credentials?.username,
          secret: credentials?.password
        }
      )

      if (calcRes !== auth.response) {
        return res.send(
          Auth.createUnauthorizedResponse(request.message.requestUri.host)
        )
      }

      // TODO: Needs test
      await location.addRoute({
        aor: "aor" in peerOrAgent ? peerOrAgent.aor : T.getTargetAOR(request),
        route: H.createRoute(request)
      })
      res.sendOk()
    } else if (hasXConnectObjectHeader(request)) {
      const connectToken = E.getHeaderValue(
        request,
        CT.ExtraHeader.CONNECT_TOKEN
      )

      try {
        const payload = await jwtVerifier.verify(connectToken)

        if (!payload.allowedMethods.includes(Method.REGISTER)) {
          return res.send(Auth.createForbideenResponse())
        }

        await location.addRoute({
          aor: payload.aor,
          route: H.createRoute(request)
        })
      } catch (e) {
        logger.verbose("unable to validate connect token", {
          originalError: e.message
        })
        res.send(Auth.createForbideenResponse())
      }
    } else {
      res.send(Auth.createUnauthorizedResponse(request.message.requestUri.host))
    }
  }
}

// TODO: Needs test
export const handleRegistry = (req: MessageRequest, res: Response) => {
  const route = H.createRouteFromLastMessage(req)
  res.send(
    pipe(
      req,
      A.addSelfVia(route),
      A.decreaseMaxForwards,
      A.removeAuthorization,
      A.removeSelfRoutes,
      A.removeXEdgePortRef
    )
  )
}

// TODO: If request has X-Connect-Token then validate the JWT value and continue
export const handleRequest =
  (location: ILocationService, apiClient?: CC.APIClient) =>
  async (request: MessageRequest, res: Response) => {
    try {
      const req = Environment.ENFORCE_E164 ? enforceE164(request) : request

      const route = E.getHeaderValue(req, CT.ExtraHeader.EDGEPORT_REF)
        ? H.createRouteFromLastMessage(req)
        : await router(location, apiClient)(req)

      if (!route) return res.sendNotFound()

      // If route is not type Route then return
      if (!("listeningPoints" in route)) {
        return res.send(route as Record<string, unknown>)
      } else {
        // Forward request to peer edgeport
        if (req.edgePortRef !== route.edgePortRef) {
          return res.send(
            pipe(
              req,
              A.addSelfVia(route as CT.Route),
              A.addSelfRecordRoute(route as CT.Route),
              // The order of the routes is important
              A.addRouteToPeerEdgePort(route as CT.Route),
              A.addRouteToNextHop(route as CT.Route),
              A.addXEdgePortRef,
              A.decreaseMaxForwards
            )
          )
        }

        res.send(tailor(route as CT.Route, req))
      }
    } catch (err) {
      res.sendInternalServerError()
      logger.error(err)
      // res.sendError(err)
    }
  }

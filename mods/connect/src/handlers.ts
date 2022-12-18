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
import { Helper as H } from "@routr/location"
import { tailor } from "./tailor"
import {
  Alterations as A,
  Extensions as E,
  Helper as HE,
  MessageRequest,
  Response,
  Target as T
} from "@routr/processor"
import { pipe } from "fp-ts/function"
import { router } from "./router"
import { ILocationService } from "@routr/location"
import { Auth, CommonConnect as CC, CommonTypes as CT } from "@routr/common"
import { findResource } from "./utils"

export const handleRegister = (
  dataAPI: CC.DataAPI,
  location: ILocationService
) => {
  return async (request: MessageRequest, res: Response) => {
    // Calculate and return challenge
    if (request.message.authorization) {
      const auth = { ...request.message.authorization }
      auth.method = request.method
      const fromURI = request.message.from.address.uri
      const peerOrAgent = await findResource(
        dataAPI,
        fromURI.host,
        fromURI.user
      )

      if (!peerOrAgent) {
        return res.send(Auth.createForbideenResponse())
      }

      const credentials = await dataAPI.get(peerOrAgent.spec.credentialsRef)

      // Calculate response and compare with the one send by the endpoint
      const calcRes = Auth.calculateAuthResponse(
        auth as CT.AuthChallengeResponse,
        {
          username: credentials?.spec.credentials.username,
          secret: credentials?.spec.credentials.password
        }
      )

      if (calcRes !== auth.response) {
        return res.send(
          Auth.createUnauthorizedResponse(request.message.requestUri.host)
        )
      }

      // TODO: Needs test
      await location.addRoute({
        aor: peerOrAgent.spec.aor || T.getTargetAOR(request),
        route: H.createRoute(request)
      })
      res.sendOk()
    } else {
      return res.send(
        Auth.createUnauthorizedResponse(request.message.requestUri.host)
      )
    }
  }
}

// TODO: Needs test
export const handleRegistry = (req: MessageRequest, res: Response) => {
  const route = HE.createRouteFromLastMessage(req)
  res.send(
    pipe(
      req,
      A.addSelfVia(route),
      A.decreaseMaxForwards,
      A.removeAuthorization,
      A.removeRoutes,
      A.removeXEdgePortRef
    )
  )
}

// TODO: If request has X-Connect-Token then validate the JWT value and continue
export const handleRequest =
  (location: ILocationService, dataAPI?: CC.DataAPI) =>
  async (req: MessageRequest, res: Response) => {
    try {
      const route = E.getHeaderValue(req, CT.ExtraHeader.EDGEPORT_REF)
        ? HE.createRouteFromLastMessage(req)
        : await router(location, dataAPI)(req)

      if (!route) return res.sendNotFound()

      // If route is not type Route then return
      if (!("user" in route)) {
        return res.send(route as Record<string, unknown>)
      } else {
        // Forward request to peer edgeport
        if (req.edgePortRef !== route.edgePortRef) {
          return pipe(
            req,
            A.addSelfVia(route as unknown as CT.Route),
            A.addRouteToPeerEdgePort(route as unknown as CT.Route),
            A.addXEdgePortRef,
            A.decreaseMaxForwards
          )
        }

        res.send(tailor(route as unknown as CT.Route, req))
      }
    } catch (err) {
      res.sendError(err)
    }
  }

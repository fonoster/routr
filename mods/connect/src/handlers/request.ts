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
import * as grpc from "@grpc/grpc-js"
import { tailor } from "../tailor"
import {
  Alterations as A,
  Extensions as E,
  MessageRequest,
  Response
} from "@routr/processor"
import { pipe } from "fp-ts/function"
import { router } from "../router"
import { ILocationService, Helper as H } from "@routr/location"
import {
  CommonConnect as CC,
  CommonTypes as CT,
  Environment,
  HeaderModifier
} from "@routr/common"
import { getLogger } from "@fonoster/logger"
import { RoutingDirection } from "./../types"

const logger = getLogger({ service: "connect", filePath: __filename })

const enforceE164 = A.enforceE164(
  Environment.ENFORCE_E164,
  Environment.ENFORCE_E164_WITH_MOBILE_PREFIX
)

export const handleRequest =
  (location: ILocationService, apiClient?: CC.APIClient) =>
  async (request: MessageRequest, res: Response) => {
    try {
      const req = Environment.ENFORCE_E164 ? enforceE164(request) : request
      let route

      if (E.getHeaderValue(req, CT.ExtraHeader.EDGEPORT_REF)) {
        route = H.createRouteFromLastMessage(req)
      } else {
        const routerResult = await router(location, apiClient)(req)
        const direction = routerResult.direction as RoutingDirection
        route = routerResult.route as CT.Route

        // If direction is not present result is an error response
        if (!("direction" in routerResult)) {
          return res.send(routerResult)
        } else if (!route && direction === RoutingDirection.AGENT_TO_PSTN) {
          return res.sendNotFound()
        } else if (!routerResult.route) {
          return res.sendTemporarilyUnavailable()
        }

        const p: HeaderModifier = {
          name: CT.ExtraHeader.CALL_DIRECTION,
          value: direction,
          action: CT.HeaderModifierAction.ADD
        }

        if (!route.headers) route.headers = []

        route.headers.push(p)
      }

      // Forward request to peer edgeport
      if (req.edgePortRef !== route.edgePortRef) {
        return res.send(
          pipe(
            req,
            A.addSelfVia(route),
            A.addSelfRecordRoute(route),
            // The order of the routes is important
            A.addRouteToPeerEdgePort(route),
            A.addRouteToNextHop(route),
            A.addXEdgePortRef,
            A.decreaseMaxForwards
          )
        )
      }

      // TODO: We should add this the Tailor API
      req.metadata = route.metadata

      res.send(tailor(route, req))
    } catch (err) {
      if (err.code === grpc.status.NOT_FOUND) {
        return res.sendTemporarilyUnavailable()
      }
      logger.error(err)
      res.sendInternalServerError()
    }
  }

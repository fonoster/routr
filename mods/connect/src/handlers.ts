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
import {Helper as H} from "@routr/location"
import {tailor} from "./tailor"
import {
  Alterations as A,
  Extensions as E,
  Helper as HE,
  MessageRequest,
  Response,
  Target as T
} from "@routr/processor"
import {pipe} from "fp-ts/function"
import {router} from "./router"
import {DataAPI} from "./types"
import {ILocationService} from "@routr/location/src/types"

export const handleRegister = (location: ILocationService) => {
  return async (request: MessageRequest, res: Response) => {
    await location.addRoute({
      aor: T.getTargetAOR(request),
      route: H.createRoute(request)
    })
    res.sendOk()
  }
}

// TODO: Needs to be completed and tested
export const handleRegistry = (req: MessageRequest, res: Response) => {
  const route = HE.createRouteFromLastMessage(req)
  const newReq = pipe(
    req,
    A.addSelfVia(route),
    A.decreaseMaxForwards,
    A.removeAuthorization,
    A.removeRoutes,
    A.removeXEdgePortRef
  )

  res.send(newReq)
}

// TODO: If request has X-Connect-Object then validate the JWT value and continue
export const handleRequest =
  (location: ILocationService, dataAPI?: DataAPI) =>
  async (req: MessageRequest, res: Response) => {
    // const route = getRoute(location, apiService)(req)
    try {
      const route =
        E.getHeaderValue(req, "x-edgeport-ref") !== undefined ||
        req.method.toString() === "ACK"
          ? HE.createRouteFromLastMessage(req)
          : await router(location, dataAPI)(req)

      if (!route) return res.sendNotFound()

      // Check if it belongs to this EdgePort
      if (req.edgePortRef !== route.edgePortRef) {
        return pipe(
          req,
          A.addSelfVia(route),
          A.updateRequestURI(route),
          A.addRoute(route),
          A.addXEdgePortRef,
          A.decreaseMaxForwards
        )
      }

      res.send(tailor(route, req))
    } catch (err) {
      res.sendError(err)
    }
  }

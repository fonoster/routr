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
import { tailorInterDomainRoute } from "./tailor"
import {
  MessageRequest,
  Response,
  Target as T,
  Extensions as E,
  Alterations as A,
  Helper as HE
} from "@routr/processor"
import { pipe } from "fp-ts/function"

export const handleRegister = (location: any) => {
  return async (request: MessageRequest, res: Response) => {
    await location.addRoute({
      aor: T.getTargetAOR(request),
      route: H.createRoute(request)
    })
    res.sendOk()
  }
}

// TODO: If request has X-Connect-Object then validate the JWT value and continue
export const handleRequest = (location: any, apiService: any) =>
  async (req: MessageRequest, res: Response) => {
    //const routeType = getRouteType(location, apiService)(req)
    //const connectObject = getConnectObject(location, apiService)(req)
    const route = E.getHeaderValue(req, "x-edgeport-ref") !== undefined || req.method.toString() === "ACK" 
      ? HE.createRouteFromLastMessage(req)
      : (await location.findRoutes({ aor: T.getTargetAOR(req) }))[0]
    
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

    res.send(tailorInterDomainRoute(route, req))
  }

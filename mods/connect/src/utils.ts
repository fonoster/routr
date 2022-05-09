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
  Alterations as A
} from "@routr/processor"
import { NetInterface, Route } from "@routr/common"
import logger from "@fonoster/logger"
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

// TODO: Move to processor and be sure to remove from scaip-processor...
// Because we updated the requestUri, we are able to re-construct the Route from the request
export function createRouteFromLastMessage(request: MessageRequest): Route {
  // The requestUri from the last message 
  const uri = (request.message.requestUri as any)
  return {
    edgePortRef: request.edgePortRef,
    user: uri.user,
    host: uri.host,
    port: uri.port,
    transport: uri.transport,
    registeredOn: Date.now(),
    sessionCount: E.getHeaderValue(request, "x-session-count") || -1,
    expires: T.getTargetExpires(request),
    listeningPoint: request.listeningPoint as NetInterface
  }
}

// TODO:
// 5. Write tests for Alterations based on new changes
// 5.1 Write handler for CANCEL
// 5.2 Test full call
// 5.3 Implement converterts Route and Record-Route?
// 6. Write remaining tailor functions
// 7. Implement getRouteType  
// 8. Implement getConnectObject (Use mock apiService)
// 9. Start working connect api
// 9.1 Create connect.json config pointing to Location and ApiService

// TODO: If request has X-Connect-Object then validate the JWT value and continue
export const handleInvite = (location: any, apiService: any) =>
  async (req: MessageRequest, res: Response) => {
    //const routeType = getRouteType(location, apiService)(req)
    //const connectObject = getConnectObject(location, apiService)(req)
    const route = E.getHeaderValue(req, "x-edgeport-ref") !== undefined
      ? createRouteFromLastMessage(req)
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

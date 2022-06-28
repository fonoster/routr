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
import {MessageRequest, NetInterface, Route, Transport} from "@routr/common"
import {Extensions as E, Target as T} from "./index"

export const isTypeResponse = (request: MessageRequest): boolean =>
  request.message.messageType === "responseType"
export const isTypeRequest = (request: MessageRequest): boolean =>
  !isTypeResponse(request)

// A request traversing a second EdgePort would have an updated the requestUri.
// Therefore, we are able to re-construct the Route from the request
export function createRouteFromLastMessage(request: MessageRequest): Route {
  // The requestUri from the last message
  const uri = request.message.requestUri

  return {
    edgePortRef: request.edgePortRef,
    user: uri.user,
    host: uri.host,
    port: uri.port,
    transport: uri.transportParam as unknown as Transport,
    registeredOn: Date.now(),
    sessionCount: E.getHeaderValue(request, "x-session-count") || -1,
    expires: T.getTargetExpires(request),
    listeningPoint: request.listeningPoint as NetInterface
  }
}

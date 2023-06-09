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
import { MessageRequest, Route, Transport } from "@routr/common"
import { CommonTypes as CT } from "@routr/common"
import { Extensions as E, Target as T } from "@routr/processor"
/* eslint-disable require-jsdoc */

// TODO: Before finalizing this, consider using the old approach of saving the rport
// and received values (like here:
//    https://github.com/fonoster/routr/blob/59bc98af86078088aede7e658c0d82a19fa18fa4/mod/registrar/utils.js#L87)
//
// Also consider: https://github.com/fonoster/routr/blob/ee5d339888344013939d06c734385f17f0cd75c2/mod/registrar/utils.js#L116
// and https://github.com/fonoster/routr/blob/ee5d339888344013939d06c734385f17f0cd75c2/mod/registrar/utils.js#L131
function buildRoute(request: MessageRequest, uri: CT.SipURI): Route {
  const via = request.message.via[0]
  const sessionCount = E.getHeaderValue(request, CT.ExtraHeader.SESSION_COUNT)
    ? parseInt(E.getHeaderValue(request, CT.ExtraHeader.SESSION_COUNT))
    : -1

  return {
    edgePortRef: request.edgePortRef,
    user: uri.user,
    host: uri.host,
    port: uri.port,
    advertisedHost: via.host,
    advertisedPort: via.port,
    transport: uri.transportParam?.toUpperCase() as Transport,
    registeredOn: Date.now(),
    sessionCount,
    expires: T.getTargetExpires(request),
    listeningPoints: request.listeningPoints,
    localnets: request.localnets,
    externalAddrs: request.externalAddrs
  }
}

export function createRoute(request: MessageRequest): Route {
  const via = request.message.via[0]
  const uri = {
    host: via.received || via.host,
    port: via.rPort !== -1 ? via.rPort : via.port,
    transportParam: via.transport.toUpperCase() as Transport,
    user: request.message.from.address.uri.user
  }

  return buildRoute(request, uri)
}

/**
 * A request traversing a second EdgePort would have updated the requestUri.
 * Therefore, we are able to re-construct the Route from the request.
 *
 * @param {MessageRequest} request - the request
 * @return {Route} the route
 */
export function createRouteFromLastMessage(request: MessageRequest): Route {
  const uri = request.message.requestUri
  const via = request.message.via[0]
  // WARNING: Workaround to avoid defaulting to UDP
  // Please see SipURIConverter.java for more details
  uri.transportParam = via.transport.toUpperCase() as Transport
  return buildRoute(request, uri)
}

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
import {Extensions as E, Target as T} from "@routr/processor"

// TODO: Before finalizing this, consider using the old approach of saving the rport
// and received values (like here:
//    https://github.com/fonoster/routr/blob/59bc98af86078088aede7e658c0d82a19fa18fa4/mod/registrar/utils.js#L87)
//
// Also consider: https://github.com/fonoster/routr/blob/ee5d339888344013939d06c734385f17f0cd75c2/mod/registrar/utils.js#L116
// and https://github.com/fonoster/routr/blob/ee5d339888344013939d06c734385f17f0cd75c2/mod/registrar/utils.js#L131
export const createRoute = (request: MessageRequest): Route => {
  const uri = request.message.contact.address.uri
  const sessionCount = E.getHeaderValue(request, "x-session-count")
    ? parseInt(E.getHeaderValue(request, "x-session-count"))
    : -1

  return {
    edgePortRef: request.edgePortRef,
    user: uri.user,
    host: uri.host,
    port: uri.port,
    transport: uri.transportParam as unknown as Transport,
    registeredOn: Date.now(),
    sessionCount,
    expires: T.getTargetExpires(request),
    listeningPoint: request.listeningPoint as NetInterface
  }
}

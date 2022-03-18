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
import { 
  MessageRequest, 
  ServiceUnavailableError 
} from "@routr/common"
import grpc = require("@grpc/grpc-js")
import { Response } from "@routr/processor"

export const createRoute = (request: MessageRequest) => {
  // TODO: Fix harcoded values
  return {
    user: 'string',
    host: 'localhost',
    port: 5060,
    transport: 'tcp',
    registeredOn: Date.now(),
    sessionCount: 0,
    expires: 30,
    edgePortRef: "001"
    // labels
  }
}

export const createRegisterHandler = (locator: {addr: string, connection: any}) => {
  return (request: MessageRequest, res: Response) => {
    const { user, host} = request.message.to as any
    const addRouteRequest = {
      aor: `sip:${user}@${host}`,
      route: createRoute(request)
    }

    locator.connection.addRoute(addRouteRequest, (err: any, response: any) => {
      if (err?.code === grpc.status.UNAVAILABLE) {
        res.sendError(new ServiceUnavailableError(locator.addr))
        return
      }
      res.sendOk()
    })
  }
} 

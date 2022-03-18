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
import grpc = require("@grpc/grpc-js/")
import { Location as L } from "@routr/location"
import { Target as T, Response }from "@routr/processor"
import logger from "@fonoster/logger"

export const createRegisterHandler = (locator: { addr: string, connection: any }) => {
  return (request: MessageRequest, res: Response) => {
    const addRouteRequest = {
      aor: T.getTargetAOR(request),
      route: L.createRoute(request)
    }

    logger.verbose("adding route request => " +JSON.stringify(addRouteRequest))

    locator.connection.addRoute(addRouteRequest, (err: any, response: any) => {
      if (err?.code === grpc.status.UNAVAILABLE) {
        res.sendError(new ServiceUnavailableError(locator.addr))
        return
      }
      res.sendOk()
    })
  }
} 

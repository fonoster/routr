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
import { LOCATION_OBJECT_PROTO } from "@routr/common"
import { 
  buildMethodNotAllowedResponse, 
  buildMethodNotImplementedResponse, 
  createRegisterHandler
} from "./utils"
import logger from "@fonoster/logger"
import grpc = require("@grpc/grpc-js")

// This processor returns upstream the message received
export default function getProcessor(locationAddr: string) {
  const locator = new LOCATION_OBJECT_PROTO.Location(locationAddr, grpc.credentials.createInsecure())

  return (call: any, callback: Function) => {
    logger.silly(JSON.stringify(call.request, null, ' '))
    switch (call.request.method) {
      case 'PUBLISH':
      case 'NOTIFY':
      case 'SUBSCRIBE':
        callback(null, buildMethodNotAllowedResponse(call.request.message))
        break
      case 'REGISTER':
        createRegisterHandler({connection: locator, addr: locationAddr})(callback, call.request)
        break
      case 'CANCEL':
        break
      default:
        callback(null, buildMethodNotImplementedResponse(call.request.message))
    }
  }
}

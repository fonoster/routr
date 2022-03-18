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
import { ConnectProcessorConfig } from "./types"
import grpc = require("@grpc/grpc-js")
import { LOCATION_OBJECT_PROTO, MessageRequest } from "@routr/common"
import Processor, { Response } from "@routr/processor"
import logger from "@fonoster/logger"
import { createRegisterHandler } from "./utils"

export default function ConnectProcessor(config: ConnectProcessorConfig) {
  const { bindAddr, locationAddr } = config
  const locator = new LOCATION_OBJECT_PROTO.Location(locationAddr, grpc.credentials.createInsecure())

  new Processor({ bindAddr, name: "connect" })
    .listen((req: MessageRequest, res: Response) => {
      
      logger.silly(JSON.stringify(req, null, ' '))

      switch (req.method.toString()) {
        case 'PUBLISH':
        case 'NOTIFY':
        case 'SUBSCRIBE':
          res.sendMethodNotAllowed()
          break
        case 'REGISTER':
          createRegisterHandler({ connection: locator, addr: locationAddr })(req, res)
          break
        case 'CANCEL':
          break
        default:
          res.sendNotImplemented()
      }
    })
}

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
import { MessageRequest } from "@routr/common"
import { LocationClient as Location } from "@routr/location"
import { handleRegister, handleRequest } from "./handlers"
import Processor, {
  Alterations as A,
  Target as T,
  Helper as H,
  Response
} from "@routr/processor"
import logger from "@fonoster/logger"

export default function ConnectProcessor(config: ConnectProcessorConfig) {
  const { bindAddr, locationAddr } = config
  const location = new Location({ addr: locationAddr })
  const apiService: any = null

  new Processor({ bindAddr, name: "connect" })
    .listen(async (req: MessageRequest, res: Response) => {
      logger.verbose("connect processor received new request", {
        ref: req.ref,
        method: req.method,
        type: req.message.messageType === "responseType" ? '(response)' : '(request)',
        edgePort: req.edgePortRef
      })
      logger.silly(JSON.stringify(req, null, ' '))

      // Check if is response and simply forwards to endpoint
      if (H.isTypeResponse(req)) {
        // Remove the proxy via before forwarding response
        return res.send(A.removeTopVia(req))
      }

      switch (req.method.toString()) {
        case 'PUBLISH':
        case 'NOTIFY':
        case 'SUBSCRIBE':
          res.sendMethodNotAllowed()
          break
        case 'CANCEL':
          const route = (await location.findRoutes({ aor: T.getTargetAOR(req) }))[0]
          res.sendOk([{
            name: 'x-request-uri',
            value: `${route.user},${route.host},${route.port},${route.transport}`
          }])
          break
        case 'REGISTER':
          await handleRegister(location)(req, res)
          break
        default:
          await handleRequest(location, apiService)(req, res)
      }
    })
}

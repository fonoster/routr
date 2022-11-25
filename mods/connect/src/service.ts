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
import { MessageRequest, Method } from "@routr/common"
import { LocationClient as Location } from "@routr/location"
import { handleRegister, handleRegistry, handleRequest } from "./handlers"
import Processor, {
  Alterations as A,
  Helper as H,
  Helper as HE,
  Target as T,
  Extensions as E,
  Response
} from "@routr/processor"
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"
import { tailor } from "./tailor"
import { getLogger } from "@fonoster/logger"

const logger = getLogger({ service: "connect", filePath: __filename })

// eslint-disable-next-line require-jsdoc
export default function ConnectProcessor(config: ConnectProcessorConfig) {
  const { bindAddr, locationAddr } = config
  const location = new Location({ addr: locationAddr })

  new Processor({ bindAddr, name: "connect" }).listen(
    async (req: MessageRequest, res: Response) => {
      logger.verbose("connect processor received new request", {
        ref: req.ref,
        method: req.method,
        type:
          req.message.messageType === CT.MessageType.RESPONSE
            ? "(response)"
            : "(request)",
        edgePort: req.edgePortRef
      })
      logger.silly(JSON.stringify(req, null, " "))

      // Check if is response and simply forwards to endpoint
      if (H.isTypeResponse(req)) {
        // Remove the proxy via before forwarding response
        return res.send(A.removeTopVia(req))
      }

      switch (req.method.toString()) {
        case Method.PUBLISH:
        case Method.NOTIFY:
        case Method.SUBSCRIBE:
          res.sendMethodNotAllowed()
          break
        case Method.CANCEL:
          // eslint-disable-next-line no-case-declarations
          const route = (
            await location.findRoutes({ aor: T.getTargetAOR(req) })
          )[0]

          if (route) {
            res.sendOk([
              {
                name: CT.ExtraHeader.REQUEST_URI,
                value: `${route?.user},${route.host},${route.port},${route.transport}`
              }
            ])
          }
          break
        case Method.REGISTER:
          if (E.getHeaderValue(req, CT.ExtraHeader.GATEWAY_AUTH)) {
            handleRegistry(req, res)
          } else {
            handleRegister(location)(req, res)
          }
          break
        case Method.BYE:
          res.send(tailor(HE.createRouteFromLastMessage(req), req))
          break
        default:
          await handleRequest(location, CC.dataAPI(config.apiAddr))(req, res)
      }
    }
  )
}

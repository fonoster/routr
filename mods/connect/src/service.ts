/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
 *
 * Licensed under the MIT License (the "License");
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
import Processor, {
  Alterations as A,
  Helper as H,
  Extensions as E,
  Response
} from "@routr/processor"
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"
import { pipe } from "fp-ts/function"
import { getLogger } from "@fonoster/logger"
import { handleRequest } from "./handlers/request"
import { handleRegistry } from "./handlers/registry"
import { handleRegister } from "./handlers/register"

const logger = getLogger({ service: "connect", filePath: __filename })

// eslint-disable-next-line require-jsdoc
export default function connectProcessor(config: ConnectProcessorConfig) {
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

      // If it is a response simply forwards to uac
      if (H.isTypeResponse(req)) {
        // Remove the proxy and overwrite the contact with the sender info
        return res.send(
          // NOTE: We should consider making the overwriteContactWithSenderInfo an Agent/Peer level alteration
          // pipe(req, A.overwriteContactWithSenderInfo, A.removeTopVia)
          pipe(req, A.removeTopVia)
        )
      }

      switch (req.method) {
        case Method.PUBLISH:
        case Method.NOTIFY:
        case Method.SUBSCRIBE:
        case Method.MESSAGE:
          res.sendMethodNotAllowed()
          break
        case Method.REGISTER:
          if (E.getHeaderValue(req, CT.ExtraHeader.GATEWAY_AUTH)) {
            handleRegistry(req, res)
          } else {
            handleRegister(CC.apiClient({ apiAddr: config.apiAddr }), location)(
              req,
              res
            )
          }
          break
        case Method.BYE:
        case Method.ACK:
          res.send(
            pipe(
              req,
              A.decreaseMaxForwards,
              A.addSelfViaUsingExternalAddrs,
              A.removeSelfRoutes
            )
          )
          break
        default:
          handleRequest(location, CC.apiClient({ apiAddr: config.apiAddr }))(
            req,
            res
          )
      }
    }
  )
}

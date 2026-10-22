/*
 * Copyright (C) 2026 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr.
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
import { isInDialog } from "./utils"
import { ILocationService } from "@routr/location"

const logger = getLogger({ service: "connect", filePath: __filename })

/**
 * Forwards a request that belongs to an existing dialog along its route set: strip
 * our own Route, add our Via, and let the EdgePort send it to the next hop or the
 * Request-URI. No routing and no access checks, the dialog was authorized when it
 * was set up. BYE and ACK always took this path; since RFC 3261 section 12.2 makes
 * any request with a To tag an in-dialog request, re-INVITE, UPDATE, INFO, REFER and
 * the NOTIFY that follows a REFER take it too.
 *
 * @param {MessageRequest} req - the in-dialog request
 * @param {Response} res - the response object used to send it on
 * @return {void}
 */
const forwardInDialog = (req: MessageRequest, res: Response) =>
  res.send(
    pipe(
      req,
      A.decreaseMaxForwards,
      A.addSelfViaUsingExternalAddrs,
      A.removeSelfRoutes
    )
  )

/**
 * Builds the connect processor's message handler. Exported so the dispatch can be
 * unit tested without a gRPC server.
 *
 * @param {object} deps - the API client and location service the handlers use
 * @return {Function} the handler to pass to Processor#listen
 */
export const createDispatcher =
  (deps: { apiClient: CC.APIClient; location: ILocationService }) =>
  async (req: MessageRequest, res: Response) => {
    const { apiClient, location } = deps
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

    // REGISTER never carries a To tag and CANCEL keeps its own path (it follows
    // the INVITE it cancels); everything else with a To tag is in a dialog.
    if (
      req.method !== Method.REGISTER &&
      req.method !== Method.CANCEL &&
      isInDialog(req)
    ) {
      return forwardInDialog(req, res)
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
          return handleRegister(apiClient, location)(req, res)
        }
        break
      case Method.BYE:
      case Method.ACK:
        forwardInDialog(req, res)
        break
      default:
        return handleRequest(location, apiClient)(req, res)
    }
  }

// eslint-disable-next-line require-jsdoc
export default function connectProcessor(config: ConnectProcessorConfig) {
  const { bindAddr, locationAddr } = config
  const location = new Location({ addr: locationAddr })
  const apiClient = CC.apiClient({ apiAddr: config.apiAddr })

  new Processor({ bindAddr, name: "connect" }).listen(
    createDispatcher({ apiClient, location })
  )
}

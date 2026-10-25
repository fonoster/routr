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
import { Helper as H } from "@routr/location"
import { Alterations as A, MessageRequest, Response } from "@routr/processor"
import { CommonErrors as CE } from "@routr/common"
import { getLogger } from "@fonoster/logger"
import { pipe } from "fp-ts/function"

const logger = getLogger({ service: "connect", filePath: __filename })

// Forwards the REGISTER the Registry sends on behalf of a trunk to the provider.
export const handleRegistry = (req: MessageRequest, res: Response) => {
  try {
    const route = H.createRouteFromLastMessage(req)
    res.send(
      pipe(
        req,
        A.addSelfVia(route),
        A.decreaseMaxForwards,
        A.removeAuthorization,
        A.removeSelfRoutes,
        A.removeXEdgePortRef
      )
    )
  } catch (err) {
    // A trunk URI with a transport this EdgePort does not listen on (e.g. tls)
    if (err instanceof CE.NoListeningPointError) {
      logger.error(err.message, {
        edgePortRef: req.edgePortRef,
        transport: err.transport
      })
      return res.sendBadGateway()
    }
    logger.error(err)
    res.sendInternalServerError()
  }
}

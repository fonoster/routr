/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
import { Helper as H, ILocationService } from "@routr/location"
import {
  Extensions as E,
  MessageRequest,
  Response,
  Target as T
} from "@routr/processor"
import {
  Auth,
  CommonConnect as CC,
  CommonTypes as CT,
  Method,
  Verifier
} from "@routr/common"
import {
  findResource,
  getVerifierImpl,
  hasXConnectObjectHeader
} from "../utils"
import { getLogger } from "@fonoster/logger"

const logger = getLogger({ service: "connect", filePath: __filename })

const jwtVerifier = getVerifierImpl()

export const handleRegister = (
  apiClient: CC.APIClient,
  location: ILocationService
) => {
  return async (request: MessageRequest, res: Response) => {
    // Calculate and return challenge
    if (request.message.authorization) {
      const auth = { ...request.message.authorization }
      auth.method = request.method
      const fromURI = request.message.from.address.uri
      const peerOrAgent = (await findResource(
        apiClient,
        fromURI.host,
        fromURI.user
      )) as CC.Peer | CC.Agent

      if (!peerOrAgent) {
        return res.send(Auth.createForbideenResponse())
      }

      const credentials = (
        peerOrAgent as { credentials: { username: string; password: string } }
      ).credentials

      // Calculate response and compare with the one send by the endpoint
      const calcRes = Auth.calculateAuthResponse(
        auth as CT.AuthChallengeResponse,
        {
          username: credentials?.username,
          secret: credentials?.password
        }
      )

      if (calcRes !== auth.response) {
        return res.send(
          Auth.createUnauthorizedResponse(request.message.requestUri.host)
        )
      }

      try {
        await location.addRoute({
          aor: "aor" in peerOrAgent ? peerOrAgent.aor : T.getTargetAOR(request),
          route: H.createRoute(request),
          maxContacts: peerOrAgent.maxContacts
        })
        res.sendRegisterOk(request)
      } catch (e) {
        // TODO: If it is a bad request then we should downgrade to verbose
        logger.error(e)
        // TODO: Check if forbidden error
        res.sendForbidden(e.details)
      }
    } else if (hasXConnectObjectHeader(request)) {
      const connectToken = E.getHeaderValue(
        request,
        CT.ExtraHeader.CONNECT_TOKEN
      )

      try {
        const payload = (await jwtVerifier.verify(
          connectToken
        )) as Verifier.VerifyResponse

        if (!payload.allowedMethods.includes(Method.REGISTER)) {
          return res.send(Auth.createForbideenResponse())
        }

        await location.addRoute({
          aor: payload.aor,
          route: H.createRoute(request)
        })

        res.sendRegisterOk(request)
      } catch (e) {
        logger.verbose("unable to validate connect token", {
          originalError: e.message
        })
        res.send(Auth.createForbideenResponse())
      }
    } else {
      res.send(Auth.createUnauthorizedResponse(request.message.requestUri.host))
    }
  }
}

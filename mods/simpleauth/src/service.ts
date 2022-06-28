#!/usr/bin/env node
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
import opentelemetry from "@opentelemetry/api"
import logger from "@fonoster/logger"
import {
  calculateAuthResponse,
  MessageRequest,
  CommonTypes as CT
} from "@routr/common"
import {createUnauthorizedResponse, getCredentials} from "./utils"
import Processor, {Response} from "@routr/processor"
import {User} from "./types"
/**
 * A simple authentication middleware that authenticates users based on a list of users
 * or whitelisted endpoints paths.
 *
 * @param {MiddlewareConfig} config - configuration for the middleware
 * @param {string} config.bindAddr - address to bind to
 * @param {User[]} config.users - list of users
 * @param {string[]} config.whiteList - list of path that required no authentication
 */
export default function simpleAuthMiddleware(config: {
  bindAddr: string
  users: User[]
  whiteList: string[]
}) {
  const {bindAddr, users, whiteList} = config

  new Processor({bindAddr, name: "simpleauth"}).listen(
    (req: MessageRequest, res: Response) => {
      const tracer = opentelemetry.trace.getTracer("routr-tracer")
      const currentSpan = opentelemetry.trace.getSpan(
        opentelemetry.context.active()
      )
      // display traceid in the terminal
      logger.silly(
        `authenticating ${req.message.from.address.uri.user} endpoint with simpleauth`,
        {traceId: currentSpan?.spanContext().traceId}
      )
      logger.silly(JSON.stringify(req, null, " "))

      const span = tracer.startSpan("server.js:sayHello()", {kind: 1})

      // Consider extending the list to other message types
      if (
        ![CT.Method.INVITE, CT.Method.MESSAGE, CT.Method.REGISTER].includes(
          req.method
        )
      ) {
        return res.send(req)
      }

      if (whiteList.includes(req.message.from.address.uri.user)) {
        span.addEvent(
          `authenticated ${req.message.from.address.uri.user} from whitelist`
        )
        span.end()
        return res.send(req)
      }

      // Calculate and return challenge
      if (req.message.authorization) {
        const auth = {...req.message.authorization}
        auth.method = req.method
        // Calculate response and compare with the one send by the endpoint
        const calcRes = calculateAuthResponse(
          auth as unknown as CT.AuthChallengeResponse,
          getCredentials(auth.username, users)
        )
        if (calcRes !== auth.response) {
          span.addEvent(
            `user ${req.message.from.address.uri.user} unauthorized to complete request`
          )
          span.end()
          return res.send(createUnauthorizedResponse(auth.realm))
        }
      } else {
        span.addEvent(
          `authorization header not found for user ${req.message.from.address.uri.user}`
        )
        span.end()
        return res.send(createUnauthorizedResponse(req.message.requestUri.host))
      }
      // Forward request to next middleware
      span.addEvent(`user ${req.message.from.address.uri.user} authorized`)
      span.end()
      res.send(req)
    }
  )
}

#!/usr/bin/env node
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
import opentelemetry from "@opentelemetry/api"
import Processor, { Response } from "@routr/processor"
import { MessageRequest, Auth, CommonTypes as CT } from "@routr/common"
import { User } from "./types"
import { getLogger } from "@fonoster/logger"

const logger = getLogger({ service: "simpledata", filePath: __filename })

/**
 * A simple authentication middleware that authenticates users based on a list of users
 * or allowlist endpoints paths.
 *
 * @param {MiddlewareConfig} config - configuration for the middleware
 * @param {string} config.bindAddr - address to bind to
 * @param {User[]} config.users - list of users
 * @param {string[]} config.allowlist - list of path that required no authentication
 */
export default function simpleAuthMiddleware(config: {
  bindAddr: string
  users: User[]
  allowlist: string[]
  methods: string[]
}) {
  const { bindAddr, users, allowlist, methods } = config

  new Processor({ bindAddr, name: "simpleauth" }).listen(
    (req: MessageRequest, res: Response) => {
      const tracer = opentelemetry.trace.getTracer("routr-tracer")
      const currentSpan = opentelemetry.trace.getSpan(
        opentelemetry.context.active()
      )

      logger.silly(
        `authenticating ${req.message.from.address.uri.user} endpoint with simpleauth`,
        { traceId: currentSpan?.spanContext().traceId }
      )

      logger.silly(JSON.stringify(req, null, " "))

      const span = tracer.startSpan("server.js:sayHello()", { kind: 1 })

      // Q: Should we extend the list to other message types?
      if (!methods.includes(req.method)) {
        return res.send(req)
      }

      if (allowlist.includes(req.message.from.address.uri.user)) {
        span.addEvent(
          `authenticated ${req.message.from.address.uri.user} from whitelist`
        )
        span.end()
        return res.send(req)
      }

      // Calculate and return challenge
      if (req.message.authorization) {
        const auth = { ...req.message.authorization }
        auth.method = req.method
        // Calculate response and compare with the one send by the endpoint
        const calcRes = Auth.calculateAuthResponse(
          auth as CT.AuthChallengeResponse,
          Auth.getCredentials(auth.username, users)
        )
        if (calcRes !== auth.response) {
          span.addEvent(
            `user ${req.message.from.address.uri.user} unauthorized to complete request`
          )
          span.end()
          return res.send(
            Auth.createUnauthorizedResponse(req.message.requestUri.host)
          )
        }
      } else {
        span.addEvent(
          `authorization header not found for user ${req.message.from.address.uri.user}`
        )
        span.end()
        return res.send(
          Auth.createUnauthorizedResponse(req.message.requestUri.host)
        )
      }
      // Forward request to next middleware
      span.addEvent(`user ${req.message.from.address.uri.user} authorized`)
      span.end()
      res.send(req)
    }
  )
}

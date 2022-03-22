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
import { MiddlewareUnavailableError } from "./errors"
import { ProcessorGPRCConnection, RunMiddlewaresParams } from "./types"
import { MessageRequest, MessageResponse } from "@routr/common"
import grpc = require("@grpc/grpc-js")
import logger from "@fonoster/logger"

async function processMessage(middlewareRef: string,
  conn: ProcessorGPRCConnection, request: MessageRequest): Promise<MessageResponse> {
  return new Promise((resolve, reject) => {
    conn.processMessage(request, (err: any, response: any) => {
      return err?.code === grpc.status.UNAVAILABLE
        ? reject(new MiddlewareUnavailableError(middlewareRef))
        : resolve(response)
    })
  })
}

export async function runMiddlewares(params: RunMiddlewaresParams): Promise<MessageRequest> {
  const { connections, request, middlewares = [] } = params
  const req = { ...request }
  return new Promise(async (resolve, rejects) => {
    for (const midd of middlewares) {
      logger.verbose("forwarding request to middleware with ref => " + midd.ref)
      // Get the next middleware
      const conn = connections.get(midd.ref)
      // Send message and re-insert response for next middleware
      try {
        req.message = (await processMessage(midd.ref, conn, req)).message
        if (req.message.messageType === "responseType") {
          logger.verbose("found messageType to be responseType and broke the chain")
          break
        }
      } catch(e) {
        rejects(e)
      }
    }
    resolve(req)
  })
}

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
import connectToBackend from "./connections"
import {ProcessorConfig} from "@routr/common"
import {RunProcessorParams} from "./types"
import {runProcessor} from "./run_processor"
import {CommonTypes as CT} from "@routr/common"
import {runMiddlewares} from "./run_middlewares"
import logger from "@fonoster/logger"

/**
 * Creates a new instance of Processor.
 *
 * @param {object} params - The parameters of the processor
 * @return {Processor}
 */
export default function processor(params: {
  processors: ProcessorConfig[]
  middlewares?: CT.MiddlewareConfig[]
}) {
  const {processors, middlewares} = params
  const procConns = connectToBackend(processors)
  const middConns = connectToBackend(middlewares)

  // Upstream request and callback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (call: RunProcessorParams, callback: any): void => {
    const {request} = call

    // Messages type reponse will not be sent to middleware chain
    if (request.message.messageType === "responseType") {
      return runProcessor({
        callback,
        request,
        processors,
        connections: procConns
      })
    }

    runMiddlewares({callback, request, middlewares, connections: middConns})
      .then((req: CT.MessageRequest) => {
        // Since the chain was broken we need to skip the processor and return the updated request
        if (req.message.messageType === "responseType") {
          logger.silly("skipped processsing request", {ref: req.ref})
          return callback(null, req)
        }
        runProcessor({
          callback,
          request: req,
          processors,
          connections: procConns
        })
      })
      .catch(callback)
  }
}

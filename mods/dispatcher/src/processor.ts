/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
import { ProcessorConfig } from "@routr/common"
import { RunProcessorParams } from "./types"
import { runProcessor } from "./run_processor"
import { CommonTypes as CT } from "@routr/common"
import { Helper as H } from "@routr/processor"
import { runMiddlewares } from "./run_middlewares"

const isErrorResponse = (request: CT.MessageRequest): boolean =>
  H.isTypeResponse(request) && !H.isOk(request) && !H.isRinging(request)

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
  const { processors, middlewares } = params
  const procConns = connectToBackend(processors)
  const middConns = connectToBackend(middlewares)

  // Upstream request and callback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (call: RunProcessorParams, callback: any): Promise<void> => {
    const { request } = call
    try {
      if (isErrorResponse(request)) {
        callback(
          null,
          await runProcessor({
            request,
            processors,
            connections: procConns
          })
        )
        return
      }

      const preProcessorRequest = await runMiddlewares({
        request,
        middlewares,
        connections: middConns,
        runPostProcessorMiddlewares: false
      })

      if (isErrorResponse(request)) {
        return callback(null, preProcessorRequest)
      }

      const processedRequest = await runProcessor({
        request: preProcessorRequest,
        processors,
        connections: procConns
      })

      if (isErrorResponse(request)) {
        return callback(null, processedRequest)
      }

      const postProcessorRequest = await runMiddlewares({
        request: processedRequest,
        middlewares,
        connections: middConns,
        runPostProcessorMiddlewares: true
      })

      return callback(null, postProcessorRequest)
    } catch (err) {
      return callback(err, null)
    }
  }
}

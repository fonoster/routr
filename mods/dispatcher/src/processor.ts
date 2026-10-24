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
import connectToBackend from "./connections"
import { ProcessorConfig } from "@routr/common"
import { RunProcessorParams } from "./types"
import { runProcessor } from "./run_processor"
import { CommonTypes as CT, Trace } from "@routr/common"
import { Helper as H } from "@routr/processor"
import { runMiddlewares } from "./run_middlewares"
import { HopCollector, Recorder, traceFlagOf } from "./recorder"

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
  recorder?: Recorder
}) {
  const { processors, middlewares, recorder } = params
  const procConns = connectToBackend(processors)
  const middConns = connectToBackend(middlewares)

  // Upstream request and callback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (call: RunProcessorParams, callback: any): Promise<void> => {
    const { request } = call
    const collector = new HopCollector({ redact: recorder?.redacts ?? true })

    // Hands the result to the EdgePort and, when recording, writes the record.
    // The trace.* metadata a component set (the recording flag, annotations)
    // is removed before the message leaves the dispatcher.
    const done = (err: unknown, result?: CT.MessageRequest) => {
      const flag = result ? traceFlagOf(result) : undefined
      recorder?.record({
        request,
        result,
        collector,
        flag,
        error: err as Error
      })
      callback(err ?? null, err ? null : withoutTraceMetadata(result))
    }

    try {
      if (isErrorResponse(request)) {
        return done(
          null,
          await runProcessor({
            request,
            processors,
            connections: procConns,
            collector
          })
        )
      }

      const preProcessorRequest = await runMiddlewares({
        request,
        middlewares,
        connections: middConns,
        runPostProcessorMiddlewares: false,
        collector
      })

      if (isErrorResponse(request)) {
        return done(null, preProcessorRequest)
      }

      const processedRequest = await runProcessor({
        request: preProcessorRequest,
        processors,
        connections: procConns,
        collector
      })

      if (isErrorResponse(request)) {
        return done(null, processedRequest)
      }

      const postProcessorRequest = await runMiddlewares({
        request: processedRequest,
        middlewares,
        connections: middConns,
        runPostProcessorMiddlewares: true,
        collector
      })

      return done(null, postProcessorRequest)
    } catch (err) {
      return done(err)
    }
  }
}

const withoutTraceMetadata = (result: CT.MessageRequest): CT.MessageRequest => {
  if (!result?.metadata) return result
  const metadata = Trace.withoutTraceMetadata(result.metadata)
  return { ...result, metadata }
}

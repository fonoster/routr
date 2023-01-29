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
import * as grpc from "@grpc/grpc-js"
import ot from "@opentelemetry/api"
import { ProcessorUnavailableError } from "./errors"
import { findProcessor } from "./find_processor"
import { RunProcessorParams } from "./types"
import { getLogger } from "@fonoster/logger"
import { MessageRequest } from "@routr/common"

const logger = getLogger({ service: "dispatcher", filePath: __filename })

/**
 * Runs the processor.
 *
 * @param {RunProcessorParams} params - The parameters for the run processor
 * @return {Promise<MessageRequest>}
 */
export async function runProcessor(
  params: RunProcessorParams
): Promise<MessageRequest> {
  const currentSpan = ot.trace.getSpan(ot.context.active())
  // Display traceid in the terminal
  logger.verbose(`traceid: ${currentSpan?.spanContext().traceId}`)

  const { connections, processors, request } = params

  return new Promise((resolve, reject) => {
    const matchResult = findProcessor(processors)(request)

    if ("code" in matchResult) {
      return reject(matchResult)
    }

    const conn = connections.get(matchResult.ref)

    logger.verbose("forwarding request to processor", { ref: matchResult.ref })

    conn.processMessage(
      request,
      (err: { code: number }, result: MessageRequest) => {
        if (err?.code === grpc.status.UNAVAILABLE) {
          // We augment the error to indicate which processor failed
          return reject(new ProcessorUnavailableError(matchResult.ref))
        }

        resolve({
          ...request,
          ...result
        })
      }
    )
  })
}

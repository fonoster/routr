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
import * as grpc from "@grpc/grpc-js"
import ot from "@opentelemetry/api"
import { ProcessorUnavailableError } from "./errors"
import { findProcessor } from "./find_processor"
import { RunProcessorParams } from "./types"
import { getLogger } from "@fonoster/logger"
import { MessageRequest, Trace } from "@routr/common"
import { performance } from "perf_hooks"
import { versionFromCall, hopMetadataOf } from "./recorder"

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
  logger.silly(`traceid: ${currentSpan?.spanContext().traceId}`)

  const { connections, processors, request, collector } = params
  const matchStartedAt = performance.now()
  const matchResult = findProcessor(processors)(request)

  if ("code" in matchResult) {
    collector?.addError({
      component: "dispatcher",
      kind: Trace.HopKind.DISPATCHER,
      startedAt: matchStartedAt,
      error: matchResult.message
    })
    throw matchResult
  }

  collector?.add({
    component: "dispatcher",
    kind: Trace.HopKind.DISPATCHER,
    durationMs: Math.round((performance.now() - matchStartedAt) * 10) / 10,
    action: Trace.HopAction.MATCHED
  })

  const conn = connections.get(matchResult.ref)
  const startedAt = performance.now()
  let version: Promise<string | undefined> = Promise.resolve(undefined)

  logger.verbose("forwarding request to processor", { ref: matchResult.ref })

  const result = await new Promise<MessageRequest>((resolve, reject) => {
    const call = conn.processMessage(
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
    version = versionFromCall(call)
  }).catch((e) => {
    collector?.addError({
      component: matchResult.ref,
      kind: Trace.HopKind.PROCESSOR,
      startedAt,
      error: (e as Error).message
    })
    throw e
  })

  collector?.addCall({
    component: matchResult.ref,
    kind: Trace.HopKind.PROCESSOR,
    version: await version,
    startedAt,
    before: request.message,
    after: result.message,
    metadata: hopMetadataOf(result)
  })

  return result
}

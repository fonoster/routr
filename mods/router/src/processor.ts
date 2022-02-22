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
import { findMatch } from "./find_match"
import connectToBackendProcessors from "./connections"
import { MessageRequest, ProcessorConfig } from "@routr/common"
import { NotMatchingProcessorFound, ProcessorUnavailableError } from "./errors"
import grpc from "@grpc/grpc-js"

type CallbackErrors = NotMatchingProcessorFound | ProcessorUnavailableError | Error
type ProcessorCallback = (err: CallbackErrors, reponse?: MessageRequest) => void

export default function processor(configList: Array<ProcessorConfig>) {

  const connections = connectToBackendProcessors(configList)

  // Upstream request and callback
  return (request: MessageRequest, callback: ProcessorCallback): void => {
    const matchResult = findMatch(configList)(request)
    if ('ref' in matchResult) {
      const conn = connections.get(matchResult.ref)
      // Connects to downstream processor
      conn.processMessage(request, (err: any, response: any) => {
        if (err?.code === grpc.status.UNAVAILABLE) {
          // We aument the error to indicate which processor failed
          callback(new ProcessorUnavailableError(matchResult.ref))
          return
        }
        callback(err, response)
      })
    } else {
      callback(matchResult)
    }
  }
}

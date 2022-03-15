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
import { MessageRequest, ProcessorConfig } from "@routr/common"
import { MiddlewareConfig } from "@routr/common/src/types"
import { NotMatchingProcessorFound, ProcessorUnavailableError } from "./errors"

export interface MessageDispatcherConfig {
  bindAddr: string
  processors: ProcessorConfig[]
  middlewares: MiddlewareConfig[]
}

export interface ProcessorGPRCConnection {
  processMessage: (request: unknown, callback: Function) => void
}

export type CallbackErrors = NotMatchingProcessorFound | ProcessorUnavailableError | Error

export type ProcessorCallback = (err: CallbackErrors, reponse?: MessageRequest) => void

export interface RunProcessorParams {
  callback: Function
  connections: Map<string, ProcessorGPRCConnection>
  processors: ProcessorConfig[]
  request: MessageRequest
}

export interface RunMiddlewaresParams {
  callback: Function
  connections: Map<string, ProcessorGPRCConnection>
  middlewares: MiddlewareConfig[]
  request: MessageRequest
}
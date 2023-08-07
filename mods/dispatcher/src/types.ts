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
import {
  MessageRequest,
  ProcessorConfig,
  CommonTypes as CT
} from "@routr/common"
import { NotMatchingProcessorFound, ProcessorUnavailableError } from "./errors"

export interface MessageDispatcherConfig {
  bindAddr: string
  processors: ProcessorConfig[]
  middlewares: CT.MiddlewareConfig[]
}

export interface ProcessorGPRCConnection {
  processMessage: (request: unknown, callback: CT.GrpcCallback) => void
}

export type CallbackErrors =
  | NotMatchingProcessorFound
  | ProcessorUnavailableError
  | Error
  | { code: number; message?: string }
  | null

export type ProcessorCallback = (
  err: CallbackErrors,
  response?: MessageRequest
) => void

export interface RunProcessorParams {
  connections: Map<string, ProcessorGPRCConnection>
  processors: ProcessorConfig[]
  request: MessageRequest
}

export interface RunMiddlewaresParams {
  connections: Map<string, ProcessorGPRCConnection>
  middlewares: CT.MiddlewareConfig[]
  request: MessageRequest
  runPostProcessorMiddlewares: boolean
}

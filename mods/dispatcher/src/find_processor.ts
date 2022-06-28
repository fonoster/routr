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
import {MessageRequest, ProcessorConfig} from "@routr/common"
import {NotMatchingProcessorFound} from "./errors"

export const hasMethod = (config: ProcessorConfig, request: MessageRequest) =>
  config.methods.includes(request.method)

// TODO: We need a way to test the matching function
export const filter = (request: MessageRequest, config: ProcessorConfig) =>
  hasMethod(config, request) && config?.matchFunc(request)

export const findProcessor =
  (list: Array<ProcessorConfig>) =>
  (request: MessageRequest): NotMatchingProcessorFound | ProcessorConfig =>
    list.find((config: ProcessorConfig) => filter(request, config)) ||
    new NotMatchingProcessorFound(request.ref)

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
import {
  PROCESSOR_OBJECT_PROTO,
  getObjectProto,
  createService,
} from "@routr/common"
import { EchoProcessorConfig } from "./types"
import logger from "@fonoster/logger"

function processMessage(call: any, callback: Function) {
  logger.verbose("Got new request: ")
  logger.verbose(JSON.stringify(call.request, null, ' '))
  const request = { ...call.request }
  // Going back / OUT
  request.direction = 1
  callback(null, request)
}

export default function EchoProcessor(config: EchoProcessorConfig) {
  const serviceInfo = {
    name: "echo",
    bindAddr: config.bindAddr,
    service: getObjectProto(PROCESSOR_OBJECT_PROTO).Processor.service,
    handlers: { processMessage }
  }
  createService(serviceInfo)
}

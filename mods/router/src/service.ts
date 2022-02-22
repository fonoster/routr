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
import processor from "./processor"
import createProcessorConnections from "./connections"
import { MessageRouterConfig } from "./types"
import { 
  PROCESSOR_OBJECT_PROTO,
  createService
} from "@routr/common"

export default function MessageRouter(config: MessageRouterConfig) {
  const connections = createProcessorConnections(config.processors)
  const serviceInfo = {
    name: "router",
    bindAddr: config.bindAddr,
    service: PROCESSOR_OBJECT_PROTO.Processor.service,
    handlers: {
      processMessage: processor(config.processors, connections)
    }
  }
  createService(serviceInfo)
}

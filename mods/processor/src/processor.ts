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
import Response from "./response"
import {ProcessorConfig} from "./types"
import {
  createService,
  MessageRequest,
  PROCESSOR_OBJECT_PROTO
} from "@routr/common"

export default class Processor {
  config: ProcessorConfig
  serviceInfo: any

  constructor(config: ProcessorConfig = {bindAddr: "0.0.0.0:51904", name: ""}) {
    this.config = config
  }

  listen(func: (request: MessageRequest, response: Response) => unknown) {
    createService({
      name: this.config.name,
      bindAddr: this.config.bindAddr,
      service: PROCESSOR_OBJECT_PROTO.Processor.service,
      handlers: {
        processMessage: (call: any, callback: Function) => {
          func(call.request, new Response(callback))
        }
      }
    })
  }
}

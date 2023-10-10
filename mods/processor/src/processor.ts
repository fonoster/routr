/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
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
import Response from "./response"
import { ProcessorConfig } from "./types"
import {
  createService,
  MessageRequest,
  PROCESSOR_OBJECT_PROTO,
  ServiceInfo,
  CommonTypes as CT
} from "@routr/common"

/**
 * Processor is a class that handles the processing of a request.
 */
export default class Processor {
  config: ProcessorConfig
  serviceInfo: ServiceInfo

  /**
   * Construct a new Processor.
   *
   * @param {ProcessorConfig} config The processor configuration
   */
  constructor(
    config: ProcessorConfig = { bindAddr: "0.0.0.0:51904", name: "" }
  ) {
    this.config = config
  }

  /**
   * Start the processor.
   *
   * @param {Function} func - starts listening for incoming messages
   */
  listen(func: (request: MessageRequest, response: Response) => unknown) {
    createService({
      name: this.config.name,
      bindAddr: this.config.bindAddr,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      service: (PROCESSOR_OBJECT_PROTO as any).Processor.service,
      handlers: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        processMessage: (call: CT.GrpcCall, callback: any) => {
          func(
            call.request as unknown as MessageRequest,
            new Response(callback)
          )
        }
      }
    })
  }
}

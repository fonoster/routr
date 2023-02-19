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
import processor from "./processor"
import {
  PROCESSOR_OBJECT_PROTO,
  ProcessorConfig,
  ServiceInfo,
  CommonTypes as CT
} from "@routr/common"

/**
 * Gets the service metadata for the dispatcher.
 *
 * @param {string} bindAddr - The address to bind to
 * @param {object} backends - The backends to use
 * @return {ServiceInfo}
 */
export function getServiceInfo(
  bindAddr: string,
  backends: {
    middlewares: CT.MiddlewareConfig[]
    processors: ProcessorConfig[]
  }
): ServiceInfo {
  return {
    name: "dispatcher",
    bindAddr,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service: (PROCESSOR_OBJECT_PROTO as any).Processor.service,
    handlers: {
      processMessage: processor(backends)
    }
  }
}

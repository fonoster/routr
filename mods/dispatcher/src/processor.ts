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
import connectToBackend from "./connections"
import { ProcessorConfig } from "@routr/common"
import { ProcessorCallback } from "./types"
import { runProcessor } from "./run_processor"
import { MessageRequest, MiddlewareConfig } from "@routr/common/src/types"
import { runMiddlewares } from "./run_middlewares"

export default function processor(params: {
  processors: ProcessorConfig[]
  middlewares?: MiddlewareConfig[]
}) {
  const { processors, middlewares } = params
  const procConns = connectToBackend(processors)
  const middConns = connectToBackend(middlewares)

  // Upstream request and callback
  return (call: any, callback: ProcessorCallback): void => {
    const { request } = call
    runMiddlewares({ callback, request, middlewares, connections: middConns })
      .then((req: MessageRequest) => 
        runProcessor({ callback, request: req, processors, connections: procConns }))
      .catch(callback)
  }
}

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
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("./tracer").init("dispatcher")
import { MessageDispatcherConfig } from "./types"
import { createService } from "@routr/common"
import { getServiceInfo } from "./util"

/**
 * Creates a service that can be used to dispatch messages to the backend processors.
 *
 * @param {MessageDispatcherConfig} config - Configuration for the dispatcher
 */
export default function messageDispatcher(config: MessageDispatcherConfig) {
  const { bindAddr, processors, middlewares } = config
  createService(getServiceInfo(bindAddr, { processors, middlewares }))
}

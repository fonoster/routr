/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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
import { ProcessorGPRCConnection } from "./types"
import {
  ProcessorConfig,
  PROCESSOR_OBJECT_PROTO,
  CommonTypes
} from "@routr/common"
import * as grpc from "@grpc/grpc-js"

/**
 * Creates a connection to all the backend processors. The function will
 * fail if any of the backends is unavailable during initialization.
 *
 * @param {ProcessorConfig} processors list of backend processors
 * @return {ProcessorGPRCConnection}
 */
export default function connectToBackend(
  processors: ProcessorConfig[] | CommonTypes.MiddlewareConfig[]
): Map<string, ProcessorGPRCConnection> {
  const procs = processors ? [...processors] : []
  const connections = new Map<string, ProcessorGPRCConnection>()
  // eslint-disable-next-line no-loops/no-loops
  for (const processor of procs) {
    connections.set(
      processor.ref,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new (PROCESSOR_OBJECT_PROTO as any).Processor(
        processor.addr,
        grpc.credentials.createInsecure()
      )
    )
  }
  return connections
}

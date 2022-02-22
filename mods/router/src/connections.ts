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
import { ProcessorGPRCConnection } from "./processor";
import {
  PROCESSOR_OBJECT_PROTO,
  getObjectProto,
  ProcessorConfig
} from "@routr/common"
const processorProto = getObjectProto(PROCESSOR_OBJECT_PROTO)
const grpc = require('@grpc/grpc-js')

export default function createProcessorConnections(processors: ProcessorConfig[])
  : Map<string, ProcessorGPRCConnection> {
  const procs = [...processors ]
  const connections = new Map<string, ProcessorGPRCConnection>()
  for (const processor of procs) {
    connections.set(processor.ref, 
      new processorProto.Processor(processor.addr, 
        grpc.credentials.createInsecure()))
  }
  return connections
}
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
import { ObjectProto, ServiceInfo } from "./types"
import logger from "@fonoster/logger"
import { ServiceDefinitionNotFound } from "./errors"

const protoLoader = require('@grpc/proto-loader')
const grpc = require('@grpc/grpc-js')
const loadOptions = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
}

// We currenly don't have a way to obtain the proto type
export const PROCESSOR_OBJECT_PROTO = getObjectProto<any>({
  name: "processor",
  version: "v2draft1",
  path: __dirname + '../../../../protos/processor.proto'
})

export function getObjectProto<A>(objectProto: ObjectProto): A | ServiceDefinitionNotFound {
  const definitions = protoLoader.loadSync(objectProto.path, loadOptions)
  const objProto = grpc.loadPackageDefinition(definitions)
    ?.fonoster?.routr[objectProto.name]
  return objProto && objProto[objectProto.version]
    ? objProto[objectProto.version]
    : new ServiceDefinitionNotFound(objectProto.name, objectProto.version)
}

export default function createService(serviceInfo: ServiceInfo) {
  const cb = () => {
    logger.info(`starting ${serviceInfo.name} service at ${serviceInfo.bindAddr}`)
    server.start()
  }
  const credentials = grpc.ServerCredentials.createInsecure()
  const server = new grpc.Server()
  server.addService(serviceInfo.service, serviceInfo.handlers)
  server.bindAsync(serviceInfo.bindAddr, credentials, cb)
}
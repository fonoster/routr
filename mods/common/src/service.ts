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
import { ServiceDefinitionNotFound } from "./errors"
import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"
import { getLogger } from "@fonoster/logger"

const logger = getLogger({ service: "common", filePath: __filename })

const loadOptions = {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
}
// TODO: Get version from the proto or package
const API_VERSION = "v2draft1"

// We currenly don't have a way to obtain the proto type
export const PROCESSOR_OBJECT_PROTO = getObjectProto({
  name: "processor",
  version: API_VERSION,
  path: __dirname + "/protos/processor.proto"
})

export const LOCATION_OBJECT_PROTO = getObjectProto({
  name: "location",
  version: API_VERSION,
  path: __dirname + "/protos/location.proto"
})

/**
 * Gets the proto definition for the given object.
 *
 * @param {ObjectProt} objectProto - The object proto to load.
 * @return {A} The proto definition.
 */
export function getObjectProto<A>(
  objectProto: ObjectProto
): A | ServiceDefinitionNotFound {
  const definitions = protoLoader.loadSync(objectProto.path, loadOptions)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const objProto = (grpc.loadPackageDefinition(definitions) as any)?.fonoster
    ?.routr[objectProto.name]
  return objProto?.[objectProto.version]
    ? objProto[objectProto.version]
    : new ServiceDefinitionNotFound(objectProto.name, objectProto.version)
}

/**
 * Creates a new service using the given service definition.
 *
 * @param {ServiceInfo} serviceInfo - The service info to create the service from.
 */
export default function createService(serviceInfo: ServiceInfo) {
  const cb = () => {
    logger.info("starting routr service", {
      name: serviceInfo.name,
      bindAddr: serviceInfo.bindAddr
    })
    server.start()
  }
  const credentials = grpc.ServerCredentials.createInsecure()
  const server = new grpc.Server()
  server.addService(serviceInfo.service, serviceInfo.handlers)
  server.bindAsync(serviceInfo.bindAddr, credentials, cb)
}

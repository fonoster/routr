import { string } from "fp-ts"

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
const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')

export const PROCESSOR_OBJECT_PROTO = {
  name: "processor",
  version: "v2beta1",
  path: __dirname + '../../../../protos/processor.proto'
}

export interface ServiceInfo {
  name: string
  bindAddr: string
  service: any
  handlers: Record<string, Function>
}

export interface ObjectProto {
  name: string
  path: string
  version: string
}

// TODO: Throw if object proto or version doesn't exist
export function getObjectProto(objectProto: ObjectProto) {
  const packageDefinition = protoLoader.loadSync(
    objectProto.path, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  })
  return grpc
    .loadPackageDefinition(packageDefinition)
      .fonoster.routr[objectProto.name][objectProto.version]
}

export default function createService(serviceInfo: ServiceInfo) {
  const server = new grpc.Server()
  server.addService(serviceInfo.service, serviceInfo.handlers)
  server.bindAsync(serviceInfo.bindAddr,
    grpc.ServerCredentials.createInsecure(), () => {
      console.log(`starting ${serviceInfo.name} service at ${serviceInfo.bindAddr}`)
      server.start()
    })
}
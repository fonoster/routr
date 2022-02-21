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
const PROTO_PATH = __dirname + '../../../../protos/processor.proto'
const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')
const packageDefinition = protoLoader.loadSync(
  PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
})
const processorProto = grpc
  .loadPackageDefinition(packageDefinition)
    .fonoster.routr.processor.v2beta1

function processMessage(call: any, callback: Function) {
  console.log("---")
  console.log("Got new request: " + JSON.stringify(call.request, null, ' '))
  const request = {...call.request}
  // Going back
  request.direction = 1
  callback(null, request)
}

// TODO: Add configuration
export default function EchoProcessor() {
  const server = new grpc.Server()
  server.addService(processorProto.Processor.service, {
    processMessage
  })
  const addr = '0.0.0.0:51902'
  server.bindAsync(addr,
    grpc.ServerCredentials.createInsecure(),
    () => {
      console.log(`started echo service at ${addr}`)
      server.start()
    })
}

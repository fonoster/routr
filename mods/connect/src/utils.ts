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
import {
  MessageRequest,
  ServiceUnavailableError
} from "@routr/common"
import grpc = require("@grpc/grpc-js")
import { Response } from "@routr/processor"
import logger from "@fonoster/logger"

const getAOR = (uri: any) => `${uri.secure ? 'sips' : 'sip'}:${uri.user}@${uri.host}`

const getTargetAOR = (request: MessageRequest) => getAOR((request.message.to as any).address.uri)

const getTargetUser = (request: MessageRequest) =>
  (request.message.contact as any).address.uri.user

const getTargetHost = (request: MessageRequest) =>
  (request.message.contact as any).address.uri.host

const getTargetPort = (request: MessageRequest) =>
  (request.message.contact as any).address.uri.port

const getTargetTransport = (request: MessageRequest) =>
  (request.message.contact as any).address.uri.transport_param

const getTargetExpires = (request: MessageRequest) => {
  // The expires value in the Contact header takes presendence over the value
  // on the Expires header
  const expires: number = (request.message.contact as any).expires
  if (expires > -1) return expires
  return (request.message.expires as { expires: number}).expires
}

const getExtensionHeaderValue = (request: any, name: string) =>
  request.message.extensions.find((ext: any) => ext.name.toLowerCase() === name.toLowerCase())?.value

const updateExtensionHeader = (request: MessageRequest, header: { name: string, value: string }) => {
  const r = { ...request };
  r.message.extensions = (r.message.extensions as any).map((ext: any) => {
    return ext.name == header.name ? header : ext
  })
  return r
}

// TODO: Before finalizing this, consider using the old approach of saving the rport
// and received values (like here:
//    https://github.com/fonoster/routr/blob/59bc98af86078088aede7e658c0d82a19fa18fa4/mod/registrar/utils.js#L87)
//
// Also consider: https://github.com/fonoster/routr/blob/ee5d339888344013939d06c734385f17f0cd75c2/mod/registrar/utils.js#L116
// and https://github.com/fonoster/routr/blob/ee5d339888344013939d06c734385f17f0cd75c2/mod/registrar/utils.js#L131
export const createRoute = (request: MessageRequest) => {
  return {
    edgePortRef: request.edge_port_ref,
    user: getTargetUser(request),
    host: getTargetHost(request),
    port: getTargetPort(request),
    transport: getTargetTransport(request),
    registeredOn: Date.now(),
    sessionCount: getExtensionHeaderValue(request, "x-session-count") || -1,
    expires: getTargetExpires(request),
    // labels
  }
}

export const createRegisterHandler = (locator: { addr: string, connection: any }) => {
  return (request: MessageRequest, res: Response) => {
    const addRouteRequest = {
      aor: getTargetAOR(request),
      route: createRoute(request)
    }

    logger.verbose("adding route request => " +JSON.stringify(addRouteRequest))

    locator.connection.addRoute(addRouteRequest, (err: any, response: any) => {
      if (err?.code === grpc.status.UNAVAILABLE) {
        res.sendError(new ServiceUnavailableError(locator.addr))
        return
      }
      res.sendOk()
    })
  }
} 
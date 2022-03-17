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
  PROCESSOR_OBJECT_PROTO, 
  MessageRequest, 
  ServiceUnavailableError 
} from "@routr/common"
import getProcessor from "./processor"
import grpc = require("@grpc/grpc-js")

export function getServiceInfo(params: { bindAddr: string }) {
  const { bindAddr } = params
  return {
    name: "connect",
    bindAddr,
    service: PROCESSOR_OBJECT_PROTO.Processor.service,
    handlers: { processMessage: getProcessor() }
  }
}

export const buildResponse = (message: Record<string, unknown>, code: number) => {
  return { message: { ...message, response_type: code } }
}

export const buildOkResponse = (message: Record<string, unknown>) => buildResponse(message, 7)

export const buildMethodNotAllowedResponse = (message: Record<string, unknown>) => buildResponse(message, 21)

export const buildMethodNotImplementedResponse = (message: Record<string, unknown>) => buildResponse(message, 47)

export const createRoute = (request: MessageRequest) => {
  // TODO: Fix harcoded values

  return {
    user: 'string',
    host: 'localhost',
    port: 5060,
    transport: 'tcp',
    registeredOn: Date.now(),
    sessionCount: 0,
    expires: 30,
    edgePortRef: "001"
    // labels
  }
}

export const createRegisterHandler = (locator: {addr: string, connection: any}) => {
  return (callback: Function, request: MessageRequest) => {
    const { user, host} = request.message.to as any
    const locRequest = {
      aor: `sip:${user}@${host}`,
      route: createRoute(request)
    }

    locator.connection.processMessage(locRequest, (err: any, response: any) => {
      if (err?.code === grpc.status.UNAVAILABLE) {
        callback(new ServiceUnavailableError(locator.addr))
        return
      }
      callback(null, buildOkResponse(request.message))
    })
  }
} 

// Work on create Route
//  The from/to needs fixing
//  Fix the contact address
//  Fix not sending edgePortRef
// Manual testing
// Unit testing

const request = {
  "external_addrs": [
    {
      "host": "192.168.1.3",
      "port": 5060,
      "transport": "TCP"
    }
  ],
  "localnets": [
    "10.100.42.127/31"
  ],
  "ref": "rnF4wq8BZFK3KgDzLqi7OQ..",
  "method": "REGISTER",
  "sender": {
    "host": "192.168.1.3",
    "port": 40822,
    "transport": "TCP"
  },
  "message": {
    "via": [
      {
        "host": "192.168.1.3",
        "port": 40822,
        "branch": "z9hG4bK-524287-1---c8734e45da773229",
        "transport": "TCP"
      }
    ],
    "extensions": [
      {
        "name": "Max-Forwards",
        "value": "70"
      },
      {
        "name": "Contact",
        "value": "<sip:1001@192.168.1.3:40822;rinstance=c57e3ee13ef7795b;transport=tcp>"
      },
      {
        "name": "To",
        "value": "<sip:1001@localhost;transport=TCP>"
      },
      {
        "name": "From",
        "value": "<sip:1001@localhost;transport=TCP>;tag=0bf53f65"
      },
      {
        "name": "CSeq",
        "value": "3 REGISTER"
      },
      {
        "name": "Expires",
        "value": "600"
      },
      {
        "name": "Allow",
        "value": "INVITE"
      },
      {
        "name": "User-Agent",
        "value": "Z 5.4.12 v2.10.13.2"
      },
      {
        "name": "Allow-Events",
        "value": "presence"
      }
    ],
    "from": null,
    "to": null,
    "call_id": {
      "call_id": "rnF4wq8BZFK3KgDzLqi7OQ.."
    },
    "content_length": {
      "content_length": 0
    },
    "expires": null,
    "www_authenticate": null,
    "authorization": {
      "realm": "localhost",
      "scheme": "Digest",
      "c_nonce": "cfed95383ddf150d1503cd8083a4a80c",
      "nonce": "c4a3cfc8cae386caaccfb24026089277",
      "algorithm": "MD5",
      "qop": "auth",
      "opaque": "",
      "response": "dfb70cb92c71aeebad6588ab637ed6ae",
      "username": "1001",
      "uri": "sip:localhost;transport=TCP",
      "nonce_count": 2
    },
    "request_uri": {
      "user": "",
      "user_password": "",
      "host": "localhost",
      "transport_param": "TCP",
      "m_addr_param": "",
      "method_param": "",
      "user_param": "",
      "t_t_l_param": 0,
      "port": 0,
      "lr_param": false,
      "secure": false
    },
    "message_type": "request_uri"
  }
}
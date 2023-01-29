/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
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
import { MessageRequest, Method, Transport } from "@routr/common"
import { MessageType } from "@routr/common/dist/types"

export const response: MessageRequest = {
  ref: "AynhXaFtbdXwHrUEzt_rUQ..",
  edgePortRef: "edge-port-01",
  method: Method.REGISTER,
  externalAddrs: ["200.22.21.42"],
  localnets: ["127.0.0.1/8", "10.100.42.127/24", "10.100.43.128/31"],
  listeningPoints: [
    {
      host: "0.0.0.0",
      port: 5060,
      transport: Transport.TCP
    },
    {
      host: "0.0.0.0",
      port: 5060,
      transport: Transport.UDP
    }
  ],
  sender: {
    host: "127.0.0.1",
    port: 36214,
    transport: Transport.WSS
  },
  message: {
    via: [
      {
        host: "127.0.0.1",
        port: 36214,
        branch: "z9hG4bK-524287-1---7315a24d84546819",
        transport: Transport.TCP
      }
    ],
    extensions: [
      {
        name: "CSeq",
        value: "14 REGISTER"
      },
      {
        name: "Allow",
        value: "INVITE"
      },
      {
        name: "User-Agent",
        value: "Z 5.4.12 v2.10.13.2"
      },
      {
        name: "Allow-Events",
        value: "presence"
      }
    ],
    from: {
      address: {
        uri: {
          user: "1001",
          userPassword: "",
          host: "sip.local",
          transportParam: Transport.UDP,
          mAddrParam: "",
          methodParam: "",
          userParam: "",
          ttlParam: -1,
          port: 5060,
          lrParam: false,
          secure: false
        },
        displayName: "John Doe",
        wildcard: false
      },
      tag: "9041462a"
    },
    to: {
      address: {
        uri: {
          user: "1001",
          userPassword: "",
          host: "sip.local",
          transportParam: Transport.TCP,
          mAddrParam: "",
          methodParam: "",
          userParam: "",
          ttlParam: -1,
          port: 5060,
          lrParam: false,
          secure: false
        },
        displayName: "",
        wildcard: false
      },
      tag: ""
    },
    contact: {
      address: {
        uri: {
          user: "1001",
          userPassword: "",
          host: "127.0.0.1",
          transportParam: Transport.TCP,
          mAddrParam: "",
          methodParam: "",
          userParam: "",
          ttlParam: -1,
          port: 36214,
          lrParam: false,
          secure: false
        },
        displayName: "",
        wildcard: false
      },
      expires: -1,
      qValue: -1
    },
    callId: {
      callId: "AynhXaFtbdXwHrUEzt_rUQ.."
    },
    contentLength: {
      contentLength: 0
    },
    maxForwards: {
      maxForwards: 70
    },
    expires: {
      expires: 60
    },
    recordRoute: [
      {
        parameters: {
          a: "1",
          b: "2"
        },
        address: {
          uri: {
            user: "",
            userPassword: "",
            host: "sip.local",
            transportParam: Transport.TCP,
            mAddrParam: "",
            methodParam: "",
            userParam: "",
            ttlParam: -1,
            port: 5060,
            lrParam: false,
            secure: false
          },
          displayName: "",
          wildcard: false
        }
      }
    ],
    route: [
      {
        parameters: null,
        address: {
          uri: {
            user: "",
            userPassword: "",
            host: "10.100.42.127",
            transportParam: Transport.TCP,
            mAddrParam: "",
            methodParam: "",
            userParam: "",
            ttlParam: -1,
            port: 5060,
            lrParam: false,
            secure: false
          },
          displayName: "",
          wildcard: false
        }
      },
      {
        parameters: null,
        address: {
          uri: {
            user: "",
            userPassword: "",
            host: "10.100.42.128",
            transportParam: Transport.TCP,
            mAddrParam: "",
            methodParam: "",
            userParam: "",
            ttlParam: -1,
            port: 5060,
            lrParam: false,
            secure: false
          },
          displayName: "",
          wildcard: false
        }
      }
    ],
    messageType: MessageType.RESPONSE
  }
}

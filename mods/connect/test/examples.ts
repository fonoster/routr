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
import {
  MessageRequest,
  Method,
  Route,
  Transport,
  CommonTypes as CT
} from "@routr/common"

// Route to Agent 1001
export const r1: Route = {
  user: "1002",
  host: "192.168.1.3",
  port: 5060,
  transport: Transport.TCP,
  sessionCount: -1,
  edgePortRef: "edge-port-01",
  listeningPoints: [
    {
      host: "10.1.1.1",
      port: 5060,
      transport: Transport.TCP
    }
  ],
  localnets: [],
  externalAddrs: [],
  labels: new Map<string, string>([["priority", "1"]])
}

// Route to Peer "ast"
export const r2: Route = {
  user: "ast",
  host: "192.168.1.9",
  port: 5060,
  transport: Transport.TCP,
  sessionCount: -1,
  edgePortRef: "edge-port-01",
  listeningPoints: [
    {
      host: "10.1.1.1",
      port: 5060,
      transport: Transport.TCP
    }
  ],
  localnets: [],
  externalAddrs: [],
  labels: new Map<string, string>([["priority", "1"]])
}

export const createRequest = (createRequestObj: {
  fromDomain: string
  fromUser: string
  toDomain: string
  toUser: string
  requestUriHost?: string
  dodNumber?: string
  dodPrivacy?: CT.Privacy
}) => {
  const request: MessageRequest = {
    ref: "AynhXaFtbdXwHrUEzt_rUQ..",
    edgePortRef: "edge-port-01",
    method: Method.INVITE,
    externalAddrs: ["200.22.21.42"],
    localnets: ["10.100.42.127/31", "10.100.42.128/31"],
    listeningPoints: [
      {
        host: "10.100.42.127",
        port: 5060,
        transport: Transport.TCP
      },
      {
        host: "10.100.42.127",
        port: 5060,
        transport: Transport.UDP
      }
    ],
    sender: {
      host: "127.0.0.1",
      port: 36214,
      transport: Transport.TCP
    },
    message: {
      via: [
        {
          host: "proxy",
          port: 5060,
          branch: "z9hG4bK-524287-1---7315a24d84546819",
          transport: Transport.TCP
        },
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
            user: createRequestObj.fromUser,
            userPassword: "",
            host: createRequestObj.fromDomain,
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
        tag: "9041462a"
      },
      to: {
        address: {
          uri: {
            user: createRequestObj.toUser,
            userPassword: "",
            host: createRequestObj.toDomain,
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
              host: "127.0.0.1",
              transportParam: "",
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
          // "parameters": null,
          address: {
            uri: {
              user: "",
              userPassword: "",
              host: "10.100.42.127",
              transportParam: "",
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
          // "parameters": null,
          address: {
            uri: {
              user: "",
              userPassword: "",
              host: "10.100.42.128",
              transportParam: "",
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
      authorization: {
        realm: "sip.local",
        scheme: "Digest",
        cNonce: "7314861c4c17b0ea43311cce5eae2506",
        nonce: "b5a3226fa1899b33872e953643e0bca9",
        algorithm: "MD5",
        qop: "",
        opaque: "",
        response: "17483289ac848e302b070cc797bf75b3",
        username: "1001",
        uri: "sip:1002@sip.local;transport=" + Transport.TCP,
        nonceCount: 13
      },
      requestUri: {
        user: createRequestObj.toUser,
        userPassword: "",
        host: createRequestObj.requestUriHost || createRequestObj.toDomain,
        transportParam: Transport.TCP,
        mAddrParam: "",
        methodParam: "",
        userParam: "",
        ttlParam: -1,
        port: 5060,
        lrParam: false,
        secure: false
      },
      messageType: CT.MessageType.REQUEST
    }
  }

  if (createRequestObj.dodNumber) {
    request.message.extensions.push({
      name: CT.ExtraHeader.DOD_NUMBER,
      value: createRequestObj.dodNumber
    })
  }

  if (createRequestObj.dodPrivacy) {
    request.message.extensions.push({
      name: CT.ExtraHeader.DOD_PRIVACY,
      value: createRequestObj.dodPrivacy
    })
  }

  return request
}

import { Method, Route, Transport } from "@routr/common";
import { create } from "domain";

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

// Route to Agent 1001
export const r1: Route = {
  user: '1002',
  host: '192.168.1.3',
  port: 5060,
  transport: Transport.TCP,
  sessionCount: -1,
  edgePortRef: "ep001",
  listeningPoint: {
    host: "10.1.1.1",
    port: 5060,
    transport: Transport.TCP,
  },
  labels: new Map<string, string>([
    ["priority", "1"]
  ])
}

// Route to Peer "ast"
export const r2: Route = {
  user: 'ast',
  host: '192.168.1.9',
  port: 5060,
  transport: Transport.TCP,
  sessionCount: -1,
  edgePortRef: "ep001",
  listeningPoint: {
    host: "10.1.1.1",
    port: 5060,
    transport: Transport.TCP,
  },
  labels: new Map<string, string>([
    ["priority", "1"]
  ])
}

export function createRequest(createRequestObj: {
  fromDomain: string
  fromUser: string
  toDomain: string
  toUser: string
}) {
  return {
    "ref": "AynhXaFtbdXwHrUEzt_rUQ..",
    "edgePortRef": "ep001",
    "method": Method.INVITE,
    "externalIps": ["200.22.21.42"],
    "localnets": ["10.100.42.127/31", "10.100.42.128/31"],
    "listeningPoint": {
      "host": "10.100.42.127",
      "port": 5060,
      "transport": Transport.TCP
    },
    "sender": {
      "host": "127.0.0.1",
      "port": 36214,
      "transport": Transport.TCP
    },
    "message": {
      "via": [
        {
          "host": "proxy",
          "port": 5060,
          "branch": "z9hG4bK-524287-1---7315a24d84546819",
          "transport": Transport.TCP
        },
        {
          "host": "127.0.0.1",
          "port": 36214,
          "branch": "z9hG4bK-524287-1---7315a24d84546819",
          "transport": Transport.TCP
        }
      ],
      "extensions": [
        {
          "name": "CSeq",
          "value": "14 REGISTER"
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
      "from": {
        "address": {
          "uri": {
            "user": createRequestObj.fromUser,
            "userPassword": "",
            "host": createRequestObj.fromDomain,
            "transportParam": Transport.TCP,
            "mAddrParam": "",
            "methodParam": "",
            "userParam": "",
            "ttlParam": -1,
            "port": 5060,
            "lrParam": false,
            "secure": false
          },
          "displayName": "",
          "wildcard": false
        },
        "tag": "9041462a"
      },
      "to": {
        "address": {
          "uri": {
            "user": createRequestObj.toUser,
            "userPassword": "",
            "host": createRequestObj.toDomain,
            "transportParam": Transport.TCP,
            "mAddrParam": "",
            "methodParam": "",
            "userParam": "",
            "tTLParam": -1,
            "port": 5060,
            "lrParam": false,
            "secure": false
          },
          "displayName": "",
          "wildcard": false
        },
        "tag": ""
      },
      "contact": {
        "address": {
          "uri": {
            "user": "1001",
            "userPassword": "",
            "host": "127.0.0.1",
            "transportParam": Transport.TCP,
            "mAddrParam": "",
            "methodParam": "",
            "userParam": "",
            "ttlParam": -1,
            "port": 36214,
            "lrParam": false,
            "secure": false
          },
          "displayName": "",
          "wildcard": false
        },
        "expires": -1,
        "qValue": -1
      },
      "callId": {
        "callId": "AynhXaFtbdXwHrUEzt_rUQ.."
      },
      "contentLength": {
        "contentLength": 0
      },
      "maxForwards": {
        "maxForwards": 70
      },
      "expires": {
        "expires": 60
      },
      "recordRoute": [
        {
          "parameters": {
            "a": "1",
            "b": "2"
          },
          "address": {
            "uri": {
              "user": "",
              "userPassword": "",
              "host": "sip.local",
              "transportParam": "",
              "mAddrParam": "",
              "methodParam": "",
              "userParam": "",
              "ttlParam": -1,
              "port": 5060,
              "lrParam": false,
              "secure": false
            },
            "displayName": "",
            "wildcard": false
          }
        }
      ],
      "route": [
        {
          // "parameters": null,
          "address": {
            "uri": {
              "user": "",
              "userPassword": "",
              "host": "10.100.42.127",
              "transportParam": "",
              "mAddrParam": "",
              "methodParam": "",
              "userParam": "",
              "ttlParam": -1,
              "port": 5060,
              "lrParam": false,
              "secure": false
            },
            "displayName": "",
            "wildcard": false
          }
        },
        {
          // "parameters": null,
          "address": {
            "uri": {
              "user": "",
              "userPassword": "",
              "host": "10.100.42.128",
              "transportParam": "",
              "mAddrParam": "",
              "methodParam": "",
              "userParam": "",
              "ttlParam": -1,
              "port": 5060,
              "lrParam": false,
              "secure": false
            },
            "displayName": "",
            "wildcard": false
          }
        }
      ],
      "authorization": {
        "realm": "sip.local",
        "scheme": "Digest",
        "cNonce": "acbcc60094edde23f49b01e18bafd34e",
        "nonce": "b8fe2321cf489ac475c80c6e5cfa1c22",
        "algorithm": "MD5",
        "qop": "auth",
        "opaque": "",
        "response": "301f56515b1fdc751c54af6d85398067",
        "username": "1001",
        "uri": "sip:voip.ms;transport=" + Transport.TCP,
        "nonceCount": 13
      },
      "requestUri": {
        "user": createRequestObj.toUser,
        "userPassword": "",
        "host": createRequestObj.toDomain,
        "transportParam": Transport.TCP,
        "mAddrParam": "",
        "methodParam": "",
        "userParam": "",
        "ttlParam": -1,
        "port": 5060,
        "lrParam": false,
        "secure": false
      },
      "messageType": "requestUri"
    }
  }
}
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
import { MessageRequest, Route } from "@routr/common"

export const route: Route = {  
  user: '1001',
  host: 'sip.local',
  port: 5060,
  transport: 'TCP',
  registeredOn: Date.now(),
  sessionCount: -1,
  expires: 600,
  edgePortRef: 'd001'
}

export const request: MessageRequest = {
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
  "ref": "AynhXaFtbdXwHrUEzt_rUQ..",
  "edge_port_ref": "ep001",
  "method": "REGISTER",
  "sender": {
    "host": "127.0.0.1",
    "port": 36214,
    "transport": "UDP"
  },
  "message": {
    "via": [
      {
        "host": "proxy",
        "port": 5060,
        "branch": "z9hG4bK-524287-1---7315a24d84546819",
        "transport": "UDP"
      },
      {
        "host": "127.0.0.1",
        "port": 36214,
        "branch": "z9hG4bK-524287-1---7315a24d84546819",
        "transport": "UDP"
      }
    ],
    "extensions": [
      {
        "name": "Max-Forwards",
        "value": "70"
      },
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
          "user": "1001",
          "user_password": "",
          "host": "voip.ms",
          "transport_param": "UDP",
          "m_addr_param": "",
          "method_param": "",
          "user_param": "",
          "t_t_l_param": -1,
          "port": 5060,
          "lr_param": false,
          "secure": false
        },
        "display_name": "",
        "wildcard": false
      },
      "tag": "9041462a"
    },
    "to": {
      "address": {
        "uri": {
          "user": "1001",
          "user_password": "",
          "host": "sip.local",
          "transport_param": "UDP",
          "m_addr_param": "",
          "method_param": "",
          "user_param": "",
          "t_t_l_param": -1,
          "port": 5060,
          "lr_param": false,
          "secure": false
        },
        "display_name": "",
        "wildcard": false
      },
      "tag": ""
    },
    "contact": {
      "address": {
        "uri": {
          "user": "1001",
          "user_password": "",
          "host": "127.0.0.1",
          "transport_param": "UDP",
          "m_addr_param": "",
          "method_param": "",
          "user_param": "",
          "t_t_l_param": -1,
          "port": 36214,
          "lr_param": false,
          "secure": false
        },
        "display_name": "",
        "wildcard": false
      },
      "expires": -1,
      "q_value": -1
    },
    "call_id": {
      "call_id": "AynhXaFtbdXwHrUEzt_rUQ.."
    },
    "content_length": {
      "content_length": 0
    },
    "expires": {
      "expires": 60
    },
    "authorization": {
      "realm": "sip.local",
      "scheme": "Digest",
      "c_nonce": "acbcc60094edde23f49b01e18bafd34e",
      "nonce": "b8fe2321cf489ac475c80c6e5cfa1c22",
      "algorithm": "MD5",
      "qop": "auth",
      "opaque": "",
      "response": "301f56515b1fdc751c54af6d85398067",
      "username": "1001",
      "uri": "sip:voip.ms;transport=UDP",
      "nonce_count": 13
    },
    "request_uri": {
      "user": "",
      "user_password": "",
      "host": "sip.local",
      "transport_param": "UDP",
      "m_addr_param": "",
      "method_param": "",
      "user_param": "",
      "t_t_l_param": -1,
      "port": 5060,
      "lr_param": false,
      "secure": false
    },
    "message_type": "request_uri"
  }
}

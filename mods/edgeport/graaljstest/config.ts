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
import {EdgePortConfig} from "../src/types"

const edgePortConfig: EdgePortConfig = {
  spec: {
    bindAddr: "127.0.0.1",
    processor: {
      addr: "localhost:51903"
    },
    externalIps: [],
    localnets: [],
    transport: [
      {
        protocol: "udp",
        port: 5060
      },
      {
        protocol: "tcp",
        port: 5060
      },
      {
        protocol: "ws",
        port: 5062
      }
    ],
    // TODO: Add this to the Spec documentation
    securityContext: {
      debugging: false,
      trustStore: "etc/certs/domains-cert.jks",
      trustStorePassword: "changeit",
      keyStore: "etc/certs/domains-cert.jks",
      keyStorePassword: "changeit",
      keyStoreType: "jks",
      client: {
        authType: "DisabledAll",
        protocols: ["SSLv3", "TLSv1.2", "TLSv1.1", "TLSv1"]
      }
    }
  }
}

const noSecurityContextEdgePortConfig = JSON.parse(
  JSON.stringify(edgePortConfig)
)
noSecurityContextEdgePortConfig.spec.securityContext = undefined
noSecurityContextEdgePortConfig.spec.transport = [
  {
    protocol: "udp",
    port: 5060
  },
  {
    protocol: "tcp",
    port: 5060
  },
  {
    protocol: "tls",
    port: 5061
  },
  {
    protocol: "ws",
    port: 5062
  },
  {
    protocol: "wss",
    port: 5063
  }
]

const duplicatedPortEdgePortConfig = JSON.parse(JSON.stringify(edgePortConfig))
duplicatedPortEdgePortConfig.spec.transport = [
  {
    protocol: "udp",
    port: 5060
  },
  {
    protocol: "tcp",
    port: 5060
  },
  {
    protocol: "tls",
    port: 5061
  },
  {
    protocol: "ws",
    port: 5062
  },
  {
    protocol: "wss",
    port: 5062
  }
]

const duplicatedProtoEdgePortConfig = JSON.parse(JSON.stringify(edgePortConfig))
duplicatedProtoEdgePortConfig.spec.transport = [
  {
    protocol: "udp",
    port: 5060
  },
  {
    protocol: "udp",
    port: 5060
  },
  {
    protocol: "tls",
    port: 5061
  },
  {
    protocol: "ws",
    port: 5062
  },
  {
    protocol: "wss",
    port: 5063
  }
]

export {
  edgePortConfig,
  noSecurityContextEdgePortConfig,
  duplicatedProtoEdgePortConfig,
  duplicatedPortEdgePortConfig
}

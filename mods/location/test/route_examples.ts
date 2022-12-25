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
import { Route, Transport } from "@routr/common"
import { Backend, LoadBalancingAlgorithm } from "../src/types"

export const simpleRoute01: Route = {
  user: "1001",
  host: "127.0.0.1",
  port: 6060,
  transport: Transport.TCP,
  registeredOn: Date.now(),
  sessionCount: -1,
  expires: 600,
  edgePortRef: "edge-port-01",
  listeningPoints: [
    {
      host: "proxy",
      port: 5060,
      transport: Transport.TCP
    }
  ],
  localnets: [],
  externalAddrs: [],
  labels: new Map<string, string>([["priority", "1"]])
}

export const simpleRoute02: Route = {
  user: "1001",
  host: "127.0.0.1",
  port: 6061,
  transport: Transport.UDP,
  registeredOn: Date.now(),
  sessionCount: -1,
  expires: 600,
  edgePortRef: "edge-port-02",
  listeningPoints: [
    {
      host: "proxy",
      port: 5060,
      transport: Transport.UDP
    }
  ],
  localnets: [],
  externalAddrs: [],
  labels: new Map<string, string>([["priority", "2"]])
}

export const voiceBackendRoute01: Route = {
  user: "voice01",
  host: "192.168.1.2",
  port: 5060,
  transport: Transport.TCP,
  registeredOn: Date.now(),
  sessionCount: 50,
  expires: 600,
  edgePortRef: "edge-port-01",
  listeningPoints: [
    {
      host: "proxy",
      port: 5060,
      transport: Transport.TCP
    }
  ],
  localnets: [],
  externalAddrs: [],
  labels: new Map<string, string>([["region", "us-east01"]])
}

export const voiceBackendRoute02: Route = {
  user: "voice02",
  host: "192.168.1.3",
  port: 5060,
  transport: Transport.UDP,
  registeredOn: Date.now(),
  sessionCount: 200,
  expires: 600,
  edgePortRef: "edge-port-01",
  listeningPoints: [
    {
      host: "proxy",
      port: 5060,
      transport: Transport.UDP
    }
  ],
  localnets: [],
  externalAddrs: []
}

export const voiceBackendRoute03: Route = {
  user: "voice03",
  host: "192.168.1.4",
  port: 5060,
  transport: Transport.UDP,
  registeredOn: Date.now(),
  sessionCount: 150,
  expires: 600,
  edgePortRef: "edge-port-01",
  listeningPoints: [
    {
      host: "proxy",
      port: 5060,
      transport: Transport.UDP
    }
  ],
  localnets: [],
  externalAddrs: []
}

export const voiceBackendRoute04: Route = {
  user: "voice04",
  host: "192.168.1.5",
  port: 5060,
  transport: Transport.UDP,
  registeredOn: Date.now(),
  sessionCount: 201,
  expires: 600,
  edgePortRef: "edge-port-01",
  listeningPoints: [
    {
      host: "proxy",
      port: 5060,
      transport: Transport.UDP
    }
  ],
  localnets: [],
  externalAddrs: []
}

export const voiceBackendRoute05: Route = {
  user: "voice05",
  host: "192.168.1.6",
  port: 5060,
  transport: Transport.UDP,
  registeredOn: Date.now(),
  sessionCount: 3,
  expires: 600,
  edgePortRef: "edge-port-01",
  listeningPoints: [
    {
      host: "proxy",
      port: 5060,
      transport: Transport.UDP
    }
  ],
  localnets: [],
  externalAddrs: []
}

export const conferenceBackendRoute01: Route = {
  user: "conference01",
  host: "conference.local",
  port: 5060,
  transport: Transport.TCP,
  registeredOn: Date.now(),
  sessionCount: 20,
  expires: 600,
  edgePortRef: "edge-port-01",
  listeningPoints: [
    {
      host: "proxy",
      port: 5060,
      transport: Transport.TCP
    }
  ],
  localnets: [],
  externalAddrs: []
}

export const conferenceBackendRoute02: Route = {
  user: "conference02",
  host: "conference.local",
  port: 5061,
  transport: Transport.TCP,
  registeredOn: Date.now(),
  sessionCount: 50,
  expires: 600,
  edgePortRef: "edge-port-01",
  listeningPoints: [
    {
      host: "proxy",
      port: 5060,
      transport: Transport.TCP
    }
  ],
  localnets: [],
  externalAddrs: []
}

export const conferenceWithExpiredRoute: Route = {
  user: "conference03",
  host: "conference.remote",
  port: 5060,
  transport: Transport.TCP,
  registeredOn: 1647054012869,
  sessionCount: 10,
  expires: 10,
  edgePortRef: "edge-port-01",
  listeningPoints: [
    {
      host: "proxy",
      port: 5060,
      transport: Transport.TCP
    }
  ],
  localnets: [],
  externalAddrs: []
}

export const backends = new Map<string, Backend>()

backends.set("backend:voice_rr", {
  ref: "voice_rr",
  balancingAlgorithm: LoadBalancingAlgorithm.ROUND_ROBIN
})

backends.set("backend:voice_ls", {
  ref: "voice-least-sessions",
  balancingAlgorithm: LoadBalancingAlgorithm.LEAST_SESSIONS
})

backends.set("backend:conference", {
  ref: "conference-with-session-affinity",
  balancingAlgorithm: LoadBalancingAlgorithm.LEAST_SESSIONS,
  withSessionAffinity: true
})

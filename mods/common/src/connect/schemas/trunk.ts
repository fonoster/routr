/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster
 *
 * This file is part of Routr.
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
export default {
  $id: "https://json-schema.org/draft/2020-12/schema",
  title: "Agent validation schema",
  description: "The spec defined for Peer validation",
  type: "object",
  properties: {
    apiVersion: {
      enum: ["v2draft1", "v2"]
    },
    kind: {
      enum: ["Trunk", "trunk"]
    },
    ref: {
      description: "Reference to the resource",
      type: "string"
    },
    metadata: {
      description: "Resource metadata",
      type: "object",
      properties: {
        name: {
          description: "Resource's friendly name",
          type: "string",
          minLength: 3,
          maxLength: 64
        }
      },
      required: ["name"]
    },
    spec: {
      description: "Operations spec for an Trunk",
      type: "object",
      properties: {
        inbound: {
          description: "Inbound configuration",
          type: "object",
          properties: {
            uri: {
              description: "URI of the inbound endpoint",
              type: "string",
              maxLength: 255
            },
            accessControlListRef: {
              description:
                "Reference to the ACL to be used for inbound traffic",
              type: "string"
            },
            credentialsRef: {
              description:
                "Reference to the credentials to be used for inbound traffic",
              type: "string"
            }
          },
          required: ["uri"]
        },
        outbound: {
          description: "Outbound configuration",
          type: "object",
          properties: {
            sendRegister: {
              description: "Whether to send register messages",
              type: "boolean"
            },
            credentialsRef: {
              description:
                "Reference to the credentials to be used for outbound traffic",
              type: "string"
            },
            uris: {
              description: "List of URIs to be used for outbound traffic",
              type: "array",
              items: {
                type: "object",
                properties: {
                  uri: {
                    description: "URI to be used for outbound traffic",
                    type: "object",
                    properties: {
                      host: {
                        description: "Hostname of the URI",
                        type: "string"
                      },
                      port: {
                        description: "Port of the URI",
                        type: "integer"
                      },
                      transport: {
                        description: "Transport of the URI",
                        enum: [
                          "TCP",
                          "SCTP",
                          "UDP",
                          "TLS",
                          "WS",
                          "WSS",
                          "tcp",
                          "sctp",
                          "udp",
                          "tls",
                          "ws",
                          "wss"
                        ]
                      },
                      user: {
                        description: "Username of the URI",
                        type: "string"
                      }
                    },
                    required: ["host", "port", "transport"]
                  },
                  weight: {
                    description: "Weight of the URI",
                    type: "integer"
                  },
                  priority: {
                    description: "Priority of the URI",
                    type: "integer"
                  },
                  enabled: {
                    description: "Whether the URI is enabled",
                    type: "boolean"
                  }
                },
                required: ["uri"]
              }
            }
          },
          required: ["uris"]
        }
      }
    }
  },
  required: ["apiVersion", "kind", "ref", "metadata", "spec"]
}

/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
export const schema = {
  $id: "https://json-schema.org/draft/2020-12/schema",
  title: "EdgPort configuration",
  description: "Configuration for an EdgePort instance",
  type: "object",
  properties: {
    kind: {
      description: "Resource type",
      type: "string"
    },
    apiVersion: {
      enum: ["v2beta1", "v2"]
    },
    ref: {
      description: "EdgePort reference",
      type: "string"
    },
    metadata: {
      description: "Resource metadata",
      type: "object",
      properties: {
        region: {
          description: "Optional region where the EdgePort is operating",
          type: "string"
        }
      }
    },
    spec: {
      description: "Operation spec for the EdgePort",
      type: "object",
      properties: {
        bindAddr: {
          description: "Ipv4 interface to accept request on",
          type: "string"
        },
        externalAddrs: {
          description: "EdgePort external ip addresses.",
          type: "array",
          items: {
            type: "string"
          },
          uniqueItems: true,
          minItems: 0
        },
        localnets: {
          description: "Networks considered to be in the same local network",
          type: "array",
          items: {
            type: "string"
          },
          uniqueItems: true,
          minItems: 0
        },
        methods: {
          description: "Acceptable SIP Methods",
          type: "array",
          items: {
            type: "string"
          },
          uniqueItems: true
        },
        unknownMethodAction: {
          description: "What to do if an incoming request type is not allowed",
          enum: ["Discard", "Respond"]
        },
        transport: {
          description: "Acceptable Transport Protocols",
          type: "array",
          items: {
            type: "object"
          },
          properties: {
            protocol: {
              type: "string"
            },
            bindAddr: {
              type: "string"
            },
            port: {
              type: "integer"
            }
          },
          required: ["port", "protocol"]
        },
        processor: {
          description: "Adjacent service for message routing",
          type: "object",
          properties: {
            addr: {
              type: "string"
            }
          }
        }
      },
      required: ["methods", "transport", "processor"]
    }
  },
  required: ["kind", "ref", "spec", "apiVersion"]
}

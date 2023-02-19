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
  title: "Message Dispatcher configuration",
  description: "Configuration for a Message Dispatcher instance",
  type: "object",
  properties: {
    kind: {
      description: "Resouce type",
      type: "string"
    },
    apiVersion: {
      description: "Resource version",
      type: "string"
    },
    ref: {
      description: "EdgePort reference",
      type: "string"
    },
    spec: {
      description: "Operations spec for EdgePort",
      type: "object",
      properties: {
        bindAddr: {
          description: "Ipv4 interface to accept request on",
          type: "string"
        },
        middlewares: {
          description: "Middleware Processors",
          type: "array",
          items: {
            type: "object"
          },
          properties: {
            ref: {
              type: "string"
            },
            addr: {
              type: "string"
            },
            postProcessor: {
              type: "boolean"
            }
          },
          required: ["ref", "addr"]
        },
        processors: {
          description: "Message Processors",
          type: "array",
          items: {
            type: "object"
          },
          properties: {
            ref: {
              type: "string"
            },
            addr: {
              type: "string"
            },
            matchFunc: {
              type: "string"
            },
            methods: {
              type: "array",
              items: {
                type: "string"
              }
            }
          },
          required: ["ref", "addr", "methods", "matchFunc"]
        }
      }
    }
  },
  required: ["kind", "ref", "spec", "apiVersion"]
}

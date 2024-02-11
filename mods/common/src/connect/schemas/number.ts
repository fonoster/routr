/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
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
  title: "Number Schema",
  description: "A JSON Schema for validating numbers.",
  type: "object",
  properties: {
    apiVersion: {
      enum: ["v2beta1", "v2"]
    },
    kind: {
      enum: ["Number", "number"]
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
          maxLength: 60
        }
      },
      required: ["name"]
    },
    spec: {
      description: "Operations spec for Numbers",
      type: "object",
      properties: {
        trunkRef: {
          description: "Reference to the trunk",
          type: "string"
        },
        location: {
          description: "Location of the number",
          type: "object",
          properties: {
            telUrl: {
              description: "Tel URL",
              type: "string"
            },
            aorLink: {
              description: "AOR link",
              type: "string",
              minLength: 5,
              maxLength: 255
            },
            sessionAffinityHeader: {
              description: "Session affinity",
              type: "string"
            },
            extraHeaders: {
              description: "Properties",
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: {
                    description: "Name of the header",
                    type: "string"
                  },
                  value: {
                    description: "Value of the header",
                    type: "string"
                  }
                }
              }
            }
          },
          required: ["telUrl"]
        }
      },
      required: ["location"]
    }
  },
  required: ["apiVersion", "kind", "ref", "metadata", "spec"]
}

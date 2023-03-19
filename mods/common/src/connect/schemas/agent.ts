/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
  description: "The spec defined for Agent validation",
  type: "object",
  properties: {
    apiVersion: {
      enum: ["v2beta1", "v2"]
    },
    kind: {
      enum: ["Agent", "agent"]
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
      description: "Operations spec for an Agent",
      type: "object",
      properties: {
        username: {
          description: "The username for the Agent",
          type: "string",
          minLength: 4,
          maxLength: 60,
          readOnly: true
        },
        domainRef: {
          description: "The domain the Agent belongs to",
          type: "string"
        },
        credentialsRef: {
          description: "The credential the Agent uses to authenticate",
          type: "string"
        },
        enabled: {
          description: "Whether the Agent is enabled (reserved for future use)",
          type: "boolean"
        },
        privacy: {
          enum: ["PRIVATE", "NONE", "Private", "None", "private", "none"]
        }
      },
      required: ["username"]
    }
  },
  required: ["apiVersion", "kind", "metadata", "spec"]
}

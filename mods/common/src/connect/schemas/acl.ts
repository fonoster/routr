/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
  title: "Location Service configuration",
  description: "Access Control List for Domains and Trunks",
  type: "object",
  properties: {
    apiVersion: {
      enum: ["v2beta1", "v2"]
    },
    kind: {
      enum: ["AccessControlList", "accesscontrollist"]
    },
    ref: {
      description: "Unique identifier for this resource",
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
      description: "Operations spec for ACL",
      type: "object",
      properties: {
        accessControlList: {
          description:
            "An object with deny and allow list of access control rules",
          type: "object",
          properties: {
            allow: {
              description: "Allowed list of access control rules",
              type: "array",
              items: {
                type: "string",
                minLength: 7,
                maxLength: 18
              },
              minItems: 1,
              uniqueItems: true
            },
            deny: {
              description: "Denied list of access control rules",
              type: "array",
              items: {
                type: "string",
                minLength: 7,
                maxLength: 18
              },
              minItems: 1,
              uniqueItems: true
            }
          }
        }
      }
    }
  },
  required: ["apiVersion", "kind", "ref", "metadata", "spec"]
}

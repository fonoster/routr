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
  title: "Domain validation schema",
  description: "The spec defined for Domain validation",
  type: "object",
  properties: {
    apiVersion: {
      enum: ["v2beta1", "v2"]
    },
    kind: {
      enum: ["Domain", "domain"]
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
      description: "Operations spec for an Domain",
      type: "object",
      properties: {
        context: {
          description: "The username for the Domain",
          type: "object",
          properties: {
            domainUri: {
              description: "The URI of the Domain",
              type: "string",
              maxLength: 255
            },
            accessControlListRef: {
              description: "The reference to the AccessControlList",
              type: "string"
            },
            egressPolicies: {
              description: "The egress policy for the Domain",
              type: "array",
              items: {
                type: "object",
                properties: {
                  rule: {
                    description: "The rule for the egress policy",
                    type: "string"
                  },
                  numberRef: {
                    description: "The reference to the number",
                    type: "string"
                  }
                },
                required: ["rule", "numberRef"]
              }
            }
          },
          required: ["domainUri"]
        }
      }
    }
  },
  required: ["apiVersion", "kind", "ref", "metadata", "spec"]
}

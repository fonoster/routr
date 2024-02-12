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
  title: "Credentials Schema",
  description: "Credentials resource for Agents and Trunks",
  type: "object",
  properties: {
    apiVersion: {
      enum: ["v2beta1", "v2"]
    },
    kind: {
      enum: ["Credentials", "credentials"]
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
      description: "Operations spec for Credentials",
      type: "object",
      properties: {
        credentials: {
          description: "Credential configuration",
          type: "object",
          properties: {
            username: {
              description: "Username",
              type: "string",
              readOnly: true,
              minLength: 4,
              maxLength: 60
            },
            password: {
              description: "Password",
              type: "string",
              writeOnly: true,
              maxLength: 255
            }
          },
          required: ["username", "password"]
        }
      },
      required: ["credentials"]
    }
  },
  required: ["apiVersion", "kind", "ref", "metadata", "spec"]
}

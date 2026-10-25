/*
 * Copyright (C) 2026 by Fonoster Inc (https://fonoster.com)
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
import { PROFILE_NAMES } from "../types"

// A profile is a map of RTPEngine ng keys. The keys are left open so a new
// RTPEngine flag can be used without a code change; only the shape of a value
// is checked, since the ng protocol takes a string or a list of strings.
const profile = {
  description:
    "RTPEngine ng parameters for this direction, merged over the shipped " +
    "defaults one key at a time. A list replaces the default list.",
  type: "object",
  additionalProperties: {
    type: ["string", "array"],
    items: { type: "string" }
  }
}

export const schema = {
  $id: "https://json-schema.org/draft/2020-12/schema",
  title: "RTPRelay configuration",
  description: "Configuration for an RTPRelay instance",
  type: "object",
  properties: {
    kind: {
      description: "Resource type",
      type: "string",
      enum: ["RTPRelay"]
    },
    apiVersion: {
      description: "Resource version",
      type: "string"
    },
    spec: {
      description: "Operations spec for the RTPRelay",
      type: "object",
      properties: {
        bindAddr: {
          description: "Ipv4 interface to accept request on",
          type: "string"
        },
        rtpengine: {
          description: "The RTPEngine instance to drive",
          type: "object",
          properties: {
            host: { type: "string" },
            port: { type: "integer", minimum: 1, maximum: 65535 }
          },
          additionalProperties: false
        },
        profiles: {
          description:
            "RTPEngine profiles by direction. Each one is optional and is " +
            "merged over the default of the same name.",
          type: "object",
          properties: Object.fromEntries(
            PROFILE_NAMES.map((name) => [name, profile])
          ),
          additionalProperties: false
        }
      },
      additionalProperties: false
    }
  },
  required: ["kind", "apiVersion", "spec"]
}

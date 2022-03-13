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
export const schema = {
  "$id": "https://json-schema.org/draft/2020-12/schema",
  "title": "Location Service configuration",
  "description": "Configuration for an instance of the Location Service",
  "type": "object",
  "properties": {
    "kind": {
      "enum": ["Location", "location"]
    },
    "apiVersion": {
      "enum": ["v2draft1"]
    },
    "metadata": {
      "description": "Resource metadata",
      "type": "object"
    },
    "spec": {
      "description": "Operations spec for Location",
      "type": "object",
      "properties": {
        "bindAddr": {
          "description": "Ipv4 interface to accept request on",
          "type": "string"
        },
        "backends": {
          "description": "Optional SIP backends",
          "type": "array",
          "items": {
            "type": "object"
          },
          "properties": {
            "ref": {
              "type": "string"
            },
            "balancingAlgorithm": {
              "enum": ["ROUND_ROBIN", "LEAST_SESSIONS"]
            },
            "sessionAffinity": {
              "description": "Optional session affinity",
              "type": "object",
              "properties": {
                "enabled": {
                  "type": "boolean"
                },
                "ref": {
                  "type": "string"
                }
              },
              "required": ["ref"]
            },
          },
          "required": ["ref"]
        },
      }
    }
  },
  "required": ["kind", "metadata", "spec", "apiVersion"]
}

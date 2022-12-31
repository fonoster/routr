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
      enum: ["v2draft1", "v2.0", "v2"]
    },
    kind: {
      enum: ["Peer", "peer"]
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
          type: "string"
        }
      },
      required: ["name"]
    },
    spec: {
      description: "Operations spec for an Peer",
      type: "object",
      properties: {
        username: {
          description: "The username for the Peer",
          type: "string",
          minLength: 3,
          maxLength: 60,
          readOnly: true
        },
        aor: {
          description:
            "Address of the Peer (acceptable schemas are sip, backend.)",
          type: "string",
          minLength: 3,
          maxLength: 255
        },
        contactAddr: {
          description: "Contact address of the Peer",
          type: "string",
          maxLength: 255
        },
        credentialsRef: {
          description: "The credential the Peer uses to authenticate",
          type: "string"
        },
        accessControlListRef: {
          description:
            "The ACL the Peer uses to control access to the Peer (Reserved for future use)",
          type: "string"
        },
        enabled: {
          description: "Whether the Peer is enabled",
          type: "boolean"
        }
      },
      required: ["username"]
    }
  },
  required: ["apiVersion", "kind", "ref", "metadata", "spec"]
}

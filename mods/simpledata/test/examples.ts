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
import {Resource} from "../src/types"

export const resources: Resource[] = [
  {
    apiVersion: "v2draft1",
    kind: "Credential",
    metadata: {
      ref: "crd2c76ft",
      name: "my-secret-credential"
    },
    spec: {
      credentials: {
        username: "myusername",
        password: "password"
      }
    }
  },
  {
    apiVersion: "v2draft1",
    kind: "AccessControlList",
    metadata: {
      ref: "acl2c77f4",
      name: "Europe ACL"
    },
    spec: {
      accessControlList: {
        deny: ["0.0.0.0/1"],
        allow: ["192.168.0.1/31"]
      }
    }
  }
]

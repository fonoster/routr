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
import { CommonConnect as CC } from "@routr/common"

export const configs: CC.RoutrResourceUnion[] = [
  {
    apiVersion: "v2draft1",
    ref: "credentials-01",
    name: "my-secret-credential",
    username: "myusername",
    password: "password"
  },
  {
    apiVersion: "v2draft1",
    ref: "acl2c77f4",
    name: "Europe ACL",
    deny: ["0.0.0.0/1"],
    allow: ["192.168.0.1/31"]
  }
]

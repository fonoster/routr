/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
 *
 * Licensed under the MIT License (the "License")
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
import { generateNonce } from "@routr/common"
import { User } from "./types"

export const getCredentials = (username: string, users: User[]) => users.find(user => user.username === username)

export const createUnauthorizedResponse = (realm: string, params: {
  qop: string,
  algorithm: string
} = { qop: "auth", algorithm: "MD5" }) => {
  return {
    message: {
      // UNAUTHORIZED CODE
      response_type: 17,
      www_authenticate: {
        scheme: 'Digest',
        realm: realm,
        qop: params.qop,
        opaque: '',
        stale: false,
        nonce: generateNonce(),
        algorithm: params.algorithm
      },
      extensions: [
        {
          "name": "Expires",
          "value": 0
        }
      ]
    }
  }
}

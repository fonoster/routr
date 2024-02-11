/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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
import * as grpc from "@grpc/grpc-js"
import { ServiceUnavailableError } from "../errors"
import { VERIFIER_PROTO } from "./grpc_client"
import { VerifyResponse } from "./types"

export const verifier = (verifierAddr: string) => {
  return (token: string): Promise<ServiceUnavailableError | VerifyResponse> => {
    const client = new VERIFIER_PROTO.Verifier(
      verifierAddr,
      grpc.credentials.createInsecure()
    )

    return new Promise((resolve, reject) => {
      client.sendMessage(
        { token },
        (err: { code: number }, response: VerifyResponse) => {
          if (err?.code === grpc.status.UNAVAILABLE) {
            return reject(new ServiceUnavailableError(verifierAddr))
          } else if (err) {
            return reject(err)
          }
          resolve(response)
        }
      )
    })
  }
}

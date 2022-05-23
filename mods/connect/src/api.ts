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
import { resources } from "./grpc_client"
import { Resource } from "./types"
import { ServiceUnavailableError } from "./errors"
import grpc = require('@grpc/grpc-js')

export function API(apiAddr: string) {
  const client = new resources.v2draft1
    .Resources(apiAddr, grpc.credentials.createInsecure())
  return {
    get: (ref: string) => new Promise<Resource>((resolve, reject) => {
      client.get({ ref }, (err: any, response: any) => {
        if (err) {
          return err?.code === grpc.status.UNAVAILABLE
            ? reject(new ServiceUnavailableError(`api server at ${apiAddr} is unavailable`))
            : reject(err)
        }
        resolve(response)
      })
    }),
    find: (query: string) => new Promise<Resource[]>((resolve, reject) => {
      client.get({ query }, (err: any, response: any) => {
        if (err) {
          return err?.code === grpc.status.UNAVAILABLE
            ? reject(new ServiceUnavailableError(`api server at ${apiAddr} is unavailable`))
            : reject(err)
        }
        resolve(response.resources)
      })
    })
  }
}

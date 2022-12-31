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
import { r1 } from "./examples"
import loadResources from "../../simpledata/src/utils"
import jp from "jsonpath"
import { ILocationService } from "@routr/location"
import { FindByResponse, Kind } from "@routr/common/dist/connect"

export const serviceAPI = (kind: Kind): CC.ServiceAPI => {
  const filteredResources = loadResources(
    __dirname + "/../../../config/resources",
    kind
  )

  return {
    get: <R>(ref: string): Promise<R> =>
      Promise.resolve(
        jp.query(filteredResources, `$..[?(@.ref=="${ref}")]`)[0]
      ),

    findBy: <R>(request: CC.FindByRequest): Promise<FindByResponse<R>> =>
      Promise.resolve({
        items: jp.query(
          filteredResources,
          `$..[?(@.${request.fieldName}=="${request.fieldValue}")]`
        )
      })
  } as unknown as CC.ServiceAPI
}

export const apiClient: CC.APIClient = {
  trunks: serviceAPI(Kind.TRUNK),
  domains: serviceAPI(Kind.DOMAIN),
  numbers: serviceAPI(Kind.NUMBER),
  acl: serviceAPI(Kind.ACL),
  agents: serviceAPI(Kind.AGENT),
  credentials: serviceAPI(Kind.CREDENTIALS),
  peers: serviceAPI(Kind.PEER)
}

export const locationAPI = {
  findRoutes: () => [r1]
} as unknown as ILocationService

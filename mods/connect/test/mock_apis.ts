/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
import {
  FindByResponse,
  Kind,
  KindWithoutUnknown
} from "@routr/common/dist/connect"

export const serviceAPI = <T>(kind: Kind): CC.ServiceAPI<T> => {
  const filteredResources = loadResources(
    __dirname + "/../../../config/resources",
    kind as KindWithoutUnknown
  )

  return {
    get: (ref: string): Promise<T> =>
      Promise.resolve(
        jp.query(filteredResources, `$..[?(@.ref=="${ref}")]`)[0]
      ),

    findBy: (request: CC.FindByRequest): Promise<FindByResponse<T>> =>
      Promise.resolve({
        items: jp.query(
          filteredResources,
          `$..[?(@.${request.fieldName}=="${request.fieldValue}")]`
        )
      })
  } as unknown as CC.ServiceAPI<T>
}

export const apiClient: CC.APIClient = {
  trunks: serviceAPI<CC.Trunk>(Kind.TRUNK),
  domains: serviceAPI<CC.Domain>(Kind.DOMAIN),
  numbers: serviceAPI<CC.INumber>(Kind.NUMBER),
  acl: serviceAPI<CC.AccessControlList>(Kind.ACL),
  agents: serviceAPI<CC.Agent>(Kind.AGENT),
  credentials: serviceAPI<CC.Credentials>(Kind.CREDENTIALS),
  peers: serviceAPI<CC.Peer>(Kind.PEER)
}

export const locationAPI = {
  findRoutes: () => [r1]
} as unknown as ILocationService

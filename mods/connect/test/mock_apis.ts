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
import {CommonConnect as CC} from "@routr/common"
import {r1} from "./examples"
import loadResources from "../../simpledata/src/utils"
import jp from "jsonpath"
import {ILocationService} from "@routr/location"

const resources: CC.Resource[] = loadResources(
  __dirname + "/../../simpledata/etc/schemas",
  __dirname + "/../../../config/resources"
)

const findCriteriaMap: any = {}

findCriteriaMap[CC.FindCriteria.FIND_AGENT_BY_USERNAME] = (
  parameters: Record<string, string>
) => `$..[?(@.spec.username=='${parameters.username}')]`

findCriteriaMap[CC.FindCriteria.FIND_CREDENTIAL_BY_REFERENCE] = (
  parameters: Record<string, string>
) => `$..[?(@.metadata.ref=='${parameters.ref}')]`

findCriteriaMap[CC.FindCriteria.FIND_DOMAIN_BY_DOMAINURI] = (
  parameters: Record<string, string>
) => `$..[?(@.spec.context.domainUri=='${parameters.domainUri}')]`

findCriteriaMap[CC.FindCriteria.FIND_NUMBER_BY_TELURL] = (
  parameters: Record<string, string>
) => `$..[?(@.spec.location.telUrl=="${parameters.telUrl}")]`

// eslint-disable-next-line require-jsdoc
export function createQuery(request: CC.FindParameters) {
  const findCriteria = request.criteria as unknown as CC.FindCriteria

  if (!request["criteria"] || !request["kind"] || !request["parameters"]) {
    return new Error(
      "createQuery request is missing 'criteria', 'kind', or 'parameters'"
    )
  }

  if (!findCriteriaMap[findCriteria]) {
    return new Error(`invalid find criteria ${request.criteria}`)
  }

  return {
    query: findCriteriaMap[findCriteria](request.parameters),
    request
  }
}

export const dataAPI: CC.DataAPI = {
  findBy: (request: CC.FindParameters) => {
    return Promise.resolve(
      jp.query(resources, (createQuery(request) as any).query)
    ) as unknown as Promise<CC.Resource[]>
  },
  get: (ref: string): Promise<CC.Resource> => {
    return Promise.resolve(
      jp.query(resources, `$..[?(@.metadata.ref=="${ref}")]`)[0]
    ) as unknown as Promise<CC.Resource>
  }
}

export const locationAPI = {
  findRoutes: () => [r1]
} as unknown as ILocationService

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
import { DataAPI, Resource } from "./types"
import { Route } from "@routr/common"
import {
  MessageRequest,
  Target as T
} from "@routr/processor"

// TODO: Fix types for location and apiService
export function router(location: any, dataAPI: DataAPI) {
  const isLocal = (req: Resource) => req != null

  return async (req: MessageRequest): Promise<Route> => {
    const fromDomain = (req.message as any).from.address.uri.host
    const requestURIDomain = (req.message as any).requestUri.host

    const calleeDomain = (await dataAPI.find(`$..[?(@.spec.context.domainUri=='${fromDomain}')]`))[0]

    // If possible avoid a second trip to the API
    const callerDomain = fromDomain === requestURIDomain ? calleeDomain
      : (await dataAPI.find(`$..[?(@.spec.context.domainUri=='${requestURIDomain}')]`))[0]

    if (isLocal(calleeDomain) && isLocal(callerDomain)) {
      return (await location.findRoutes({ aor: T.getTargetAOR(req) }))[0]
    }
  }
}

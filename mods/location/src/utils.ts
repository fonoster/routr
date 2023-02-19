/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
import {
  LOCATION_OBJECT_PROTO,
  Route,
  ServiceInfo,
  CommonTypes as CT
} from "@routr/common"
import { NotRoutesFoundForAOR } from "./errors"
import { AddRouteRequest, FindRoutesRequest, ILocationService } from "./types"

export const expiredFilter = (r: Route) =>
  r.expires - (Date.now() - r.registeredOn) / 1000 > 0

export const duplicateFilter = (r1: Route, r2: Route) =>
  !(r1.host === r2.host && r1.port === r2.port)

export const mergeKeyValue = (map: Map<string, string>) =>
  Array.from(map).map((l) => l[0] + l[1])

export const compareArrays = (arr: string[], target: string[]) =>
  target.every((v) => arr.includes(v)) && arr.length === target.length

export const filterOnlyMatchingLabels =
  (requestLabels: Map<string, string>) => (route: Route) =>
    route.labels
      ? compareArrays(mergeKeyValue(requestLabels), mergeKeyValue(route.labels))
      : false

export const getServiceInfo = (
  bindAddr: string,
  locator: ILocationService
): ServiceInfo => {
  return {
    name: "location",
    bindAddr,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service: (LOCATION_OBJECT_PROTO as any).Location.service,
    handlers: {
      addRoute: (call: CT.GrpcCall, callback) => {
        try {
          locator.addRoute(call.request as AddRouteRequest)
          callback(null, {})
        } catch (e) {
          callback(e, null)
        }
      },
      findRoutes: async (call: CT.GrpcCall, callback) => {
        try {
          const routes = await locator.findRoutes(
            call.request as FindRoutesRequest
          )
          if (routes.length === 0)
            throw new NotRoutesFoundForAOR(call.request.aor)
          callback(null, {
            routes: routes
          })
        } catch (e) {
          callback(e, null)
        }
      },
      removeRoutes: async (call: CT.GrpcCall, callback) => {
        try {
          callback(null, {
            routes: await locator.findRoutes(call.request as FindRoutesRequest)
          })
        } catch (e) {
          callback(e, null)
        }
      }
    }
  }
}

export const configFromString = (
  params: string,
  allowedKeys: string[]
): Record<string, string | boolean> => {
  if (params.length === 0) return {}
  const parameters: Record<string, string | boolean> = {}
  params.split(",").forEach((par) => {
    try {
      const key = par.split("=")[0]
      const value = par.split("=")[1]
      if (allowedKeys.indexOf(key) === -1) {
        throw new Error(`invalid parameter: ${key}`)
      } else {
        parameters[key] = value === "true" ? true : value
      }
    } catch (e) {
      throw new Error(
        `invalid parameters string: ${params}; should be something like 'host=localhost,port=6379'`
      )
    }
  })
  return parameters
}

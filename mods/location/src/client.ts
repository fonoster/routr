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
import {
  AddRouteRequest,
  FindRoutesRequest,
  ILocationService,
  RemoveRoutesRequest
} from "./types"
import {
  LOCATION_OBJECT_PROTO,
  Route,
  ServiceUnavailableError
} from "@routr/common"
import * as grpc from "@grpc/grpc-js"

type RequestType = AddRouteRequest | FindRoutesRequest | RemoveRoutesRequest

const container = (self: Location, request: RequestType, name: string) => {
  return new Promise((resolve, reject) => {
    self.location[name](request, (err: { code: number }, response: unknown) => {
      if (err?.code === grpc.status.UNAVAILABLE) {
        return reject(new ServiceUnavailableError(self.config.addr))
      }
      resolve(response)
    })
  })
}

/**
 * Location client
 */
export default class Location implements ILocationService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  location: any
  config: { addr: string }

  /**
   * Create a new Location client.
   *
   * @param {object} config - Location client config
   * @param {string} config.addr - Location service address
   */
  constructor(config: { addr: string }) {
    this.config = config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.location = new (LOCATION_OBJECT_PROTO as any).Location(
      config.addr,
      grpc.credentials.createInsecure()
    )
  }

  /**
   * Add a route to the location service.
   *
   * @param {AddRouteRequest} request - Add route request
   * @param {string} request.aor - AOR of the route
   * @param {Route} request.route - Route to add
   * @return {Promise<void>}
   */
  public addRoute(request: AddRouteRequest): Promise<void> {
    return container(
      this,
      request,
      this.addRoute.name
    ) as unknown as Promise<void>
  }

  /**
   * Add a route to the location service.
   *
   * @param {FindRoutesResponse} request - Request to find routes
   * @param {string} request.aor - AOR of the route
   * @param {Map<string, string>} request.labels - Optional Route labels
   * @param {string} request.sessionAffinityRef - Optiona session affinity ref
   * @return {Promise<void>}
   */
  public async findRoutes(request: FindRoutesRequest): Promise<Route[]> {
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((await container(this, request, this.findRoutes.name)) as any)?.routes ||
      ([] as Route[])
    )
  }

  /**
   * Add a route to the location service.
   *
   * @param {RemoveRoutesRequest} request - Remove routes request
   * @param {string} request.aor - AOR of the route
   * @return {Promise<void>}
   */
  public removeRoutes(request: RemoveRoutesRequest): Promise<void> {
    return container(
      this,
      request,
      this.removeRoutes.name
    ) as unknown as Promise<void>
  }
}

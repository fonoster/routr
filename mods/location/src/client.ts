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
import grpc = require("@grpc/grpc-js")

function container(self: any, request: any, name: string) {
  return new Promise((resolve, reject) => {
    self.location[name](request, (err: any, response: any) => {
      if (err?.code === grpc.status.UNAVAILABLE) {
        return reject(new ServiceUnavailableError(this.config.addr))
      }
      resolve(response)
    })
  })
}

export default class Location implements ILocationService {
  location: any
  config: {addr: string}

  constructor(config: {addr: string}) {
    this.config = config
    this.location = new LOCATION_OBJECT_PROTO.Location(
      config.addr,
      grpc.credentials.createInsecure()
    )
  }

  public addRoute(request: AddRouteRequest): Promise<void> {
    return container(
      this,
      request,
      this.addRoute.name
    ) as unknown as Promise<void>
  }

  public async findRoutes(request: FindRoutesRequest): Promise<Route[]> {
    return (
      ((await container(this, request, this.findRoutes.name)) as any)?.routes ||
      ([] as Route[])
    )
  }

  public removeRoutes(request: RemoveRoutesRequest): Promise<void> {
    return container(
      this,
      request,
      this.removeRoutes.name
    ) as unknown as Promise<void>
  }
}

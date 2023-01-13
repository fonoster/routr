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
import { UnsupportedSchema } from "./errors"
import {
  AddRouteRequest,
  Backend,
  FindRoutesRequest,
  ILocationService,
  ILocatorStore,
  RemoveRoutesRequest
} from "./types"
import { Route, CommonTypes as CT } from "@routr/common"
import { filterOnlyMatchingLabels } from "./utils"

enum AOR_SCHEME {
  SIP = "sip:",
  BACKEND = "backend:"
}

/**
 * A locator store that uses the location service to find routes for AORs.
 */
export default class Location implements ILocationService {
  private store: ILocatorStore
  private rrCount: Map<string, number>

  /**
   * Creates a new Location service. Should fail if any backend has sessionAffinity and round-robin
   *
   * @param {ILocatorStore} store - The store to use for the location service
   * @param {Map<string, Backend>} backends - The backends to use for the location service
   */
  constructor(store: ILocatorStore) {
    this.store = store
    this.rrCount = new Map<string, number>()
  }

  /** @inheritdoc */
  public addRoute(request: AddRouteRequest): Promise<void> {
    if (
      !request.aor.startsWith(AOR_SCHEME.SIP) &&
      !request.aor.startsWith(AOR_SCHEME.BACKEND)
    ) {
      throw new UnsupportedSchema(request.aor)
    }
    return this.store.put(request.aor, request.route)
  }

  /** @inheritdoc */
  public async findRoutes(request: FindRoutesRequest): Promise<Route[]> {
    let routes = await this.store.get(request.callId)

    if (routes.length > 0) {
      return routes
    }

    routes = request.labels
      ? (await this.store.get(request.aor)).filter(
          filterOnlyMatchingLabels(request.labels)
        )
      : (await this.store.get(request.aor)) ?? []

    if (request.aor.startsWith(AOR_SCHEME.SIP)) {
      // Set call to the last route
      this.store.put(request.callId, routes[0])
      return routes
    } else if (request.aor.startsWith(AOR_SCHEME.BACKEND)) {
      const { backend } = request

      // If it has not affinity sesssion then get next
      const r =
        // Falls back to round-robin if no session affinity ref is provided
        backend.withSessionAffinity && request.sessionAffinityRef
          ? [await this.nextWithAffinity(routes, request.sessionAffinityRef)]
          : [this.next(routes, backend)]

      // Next time we will get the route with callId
      this.store.put(request.callId, r[0])

      return r
    }
    throw new UnsupportedSchema(request.aor)
  }

  /** @inheritdoc */
  public removeRoutes(request: RemoveRoutesRequest): Promise<void> {
    return this.store.delete(request.aor)
  }

  // eslint-disable-next-line require-jsdoc
  private next(routes: Array<Route>, backend: Backend): Route {
    if (
      backend.balancingAlgorithm === CT.LoadBalancingAlgorithm.LEAST_SESSIONS
    ) {
      return routes.sort((r1, r2) => r1.sessionCount - r2.sessionCount)[0]
    }

    // Continues using round-robin
    const nextPosition =
      this.rrCount.get(`${AOR_SCHEME.BACKEND}${backend.ref}`) ?? 0

    const result = routes[nextPosition]

    if (nextPosition >= routes.length - 1) {
      // Restarting round-robin counter
      this.rrCount.set(`${AOR_SCHEME.BACKEND}${backend.ref}`, 0)
    } else {
      this.rrCount.set(`${AOR_SCHEME.BACKEND}${backend.ref}`, nextPosition + 1)
    }

    return result
  }

  // Backend with session affinity does not support round-robin
  // eslint-disable-next-line require-jsdoc
  private async nextWithAffinity(
    routes: Array<Route>,
    sessionAffinityHeader: string
  ): Promise<Route> {
    const route = await this.store.get(sessionAffinityHeader)

    if (route.length > 0) {
      return route[0]
    }

    const r = routes.sort((r1, r2) => r1.sessionCount - r2.sessionCount)[0]
    this.store.put(sessionAffinityHeader, r)

    return r
  }
}

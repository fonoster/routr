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
  NotRoutesFoundForAOR, 
  UnsupportedSchema 
} from "./errors";
import {
  AddRouteRequest,
  Backend,
  FindRoutesRequest,
  ILocationService,
  ILocatorStore,
  LB_ALGORITHM,
  RemoveRoutesRequest,
} from "./types";
import { Route } from "@routr/common"
import { filterOnlyMatchingLabels, hasAffinitySession } from "./utils";

export default class Location implements ILocationService {
  private store: ILocatorStore
  private backends: Map<string, Backend>
  private rrCount: Map<string, number>
  private affinityStore: Map<string, Route>

  // Should fail if any backend has sessionAffinity and round-robin
  constructor(store: ILocatorStore, backends: Map<string, Backend> = new Map()) {
    this.store = store
    this.backends = backends
    this.rrCount = new Map<string, number>()
    this.affinityStore = new Map<string, Route>()
    this.backends.forEach((value, key) => this.rrCount.set(key, 0))
  }

  public addRoute(request: AddRouteRequest): Promise<void> {
    if (!request.aor.startsWith('sip:') &&
      !request.aor.startsWith('backend:')) {
      throw new UnsupportedSchema(request.aor)
    }
    return this.store.put(request.aor, request.route);
  }

  public async findRoutes(request: FindRoutesRequest): Promise<Route[]>{
    const routes = request.labels
      ? (await this.store.get(request.aor))
        .filter(filterOnlyMatchingLabels(request.labels))
      : await this.store.get(request.aor) || []

    if (request.aor.startsWith('sip:')) {
      return routes
    } else if (request.aor.startsWith('backend:')) {
      const backend = this.backends.get(request.aor)

      if (!backend) {
        throw new NotRoutesFoundForAOR(request.aor)
      }

      // If it has not affinity sesssion then get next
      return !hasAffinitySession(backend)
          ? [this.next(routes, backend)]
          : [this.nextWithAffinity(await routes, backend.sessionAffinity.ref)]
    }
    throw new UnsupportedSchema(request.aor)
  }

  public removeRoutes(request: RemoveRoutesRequest): Promise<void> {
    return this.store.delete(request.aor)
  }

  private next(routes: Array<Route>, backend: Backend): Route {
    if (backend.balancingAlgorithm === LB_ALGORITHM.LEAST_SESSIONS) {
      return routes.sort((r1, r2) => r1.sessionCount - r2.sessionCount)[0]
    }

    // Continues using round-robin
    const nextPosition = this.rrCount.get(`backend:${backend.ref}`)
    const result = routes[nextPosition];

    if (nextPosition >= (routes.length - 1)) {
      // Restarting round-robin counter
      this.rrCount.set(`backend:${backend.ref}`, 0)
    } else {
      this.rrCount.set(`backend:${backend.ref}`, nextPosition + 1)
    }

    return result
  }

  // Backend with session affinity does not support round-robin
  private nextWithAffinity(routes: Array<Route>, sessionAffinityRef: string): Route {
    let route = this.affinityStore.get(sessionAffinityRef)
    if (route) {
      return route
    }

    route = routes.sort((r1, r2) => r1.sessionCount - r2.sessionCount)[0]
    this.affinityStore.set(sessionAffinityRef, route)

    return route
  }
}
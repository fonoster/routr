/* eslint-disable require-jsdoc */
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
import { UnsupportedSchema } from "./errors"
import { CommonErrors as CE } from "@routr/common"
import {
  AddRouteRequest,
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
   */
  constructor(store: ILocatorStore) {
    this.store = store
    this.rrCount = new Map<string, number>()
  }

  /** @inheritdoc */
  public async addRoute(request: AddRouteRequest): Promise<void> {
    if (
      !request.aor.startsWith(AOR_SCHEME.SIP) &&
      !request.aor.startsWith(AOR_SCHEME.BACKEND)
    ) {
      throw new UnsupportedSchema(request.aor)
    }

    const existingRoutes = await this.store.get(request.aor)
    const routeExists = existingRoutes.some(
      (route) =>
        route.user === request.route.user &&
        route.host === request.route.host &&
        route.port === request.route.port &&
        route.transport === request.route.transport
    )

    if (
      !routeExists &&
      request.maxContacts !== undefined &&
      existingRoutes.length >= request.maxContacts
    ) {
      throw new CE.BadRequestError(
        `exceeds maximum of ${request.maxContacts} allowed contacts`
      )
    }
    return await this.store.put(request.aor, request.route)
  }

  /** @inheritdoc */
  public async findRoutes(request: FindRoutesRequest): Promise<Route[]> {
    const formatLabels = (labelsMap: Map<string, string>) => {
      return Array.from(labelsMap)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, value]) => `${key}=${value}`)
        .join(";")
    }

    const labelString = request.labels ? formatLabels(request.labels) : null
    const storeKeyWithLabels = labelString
      ? `${request.aor}:${request.callId}:${labelString}`
      : `${request.aor}:${request.callId}`

    let routes = await this.store.get(storeKeyWithLabels)

    if (routes && routes.length > 0) {
      return routes
    }

    if (labelString) {
      const storeKey = `${request.aor}:${request.callId}:${labelString}`
      routes = await this.store.get(storeKey)

      if (!routes || routes.length === 0) {
        routes = (await this.store.get(request.aor)).filter(
          filterOnlyMatchingLabels(request.labels)
        )
      }
    } else {
      routes = (await this.store.get(request.aor)) ?? []
    }

    const { backend } = request

    if (!backend) {
      this.store.put(`${request.aor}:${request.callId}`, routes[0])
      return routes
    }

    // If it has no affinity session then get next
    const r =
      backend?.withSessionAffinity && request.sessionAffinityRef
        ? [await this.nextWithAffinity(routes, request.sessionAffinityRef)]
        : [this.next(routes, request)]

    this.store.put(storeKeyWithLabels, r[0])

    return r
  }

  /** @inheritdoc */
  public removeRoutes(request: RemoveRoutesRequest): Promise<void> {
    return this.store.delete(request.aor)
  }

  private next(routes: Array<Route>, request: FindRoutesRequest): Route {
    const { backend } = request
    const ref = backend?.ref || request.aor
    if (
      backend?.balancingAlgorithm === CT.LoadBalancingAlgorithm.LEAST_SESSIONS
    ) {
      return routes.sort((r1, r2) => r1.sessionCount - r2.sessionCount)[0]
    }

    // Continues using round-robin
    const nextPosition = this.rrCount.get(ref) ?? 0
    const result = routes[nextPosition]

    if (nextPosition >= routes.length - 1) {
      // Restarting round-robin counter
      this.rrCount.set(ref, 0)
    } else {
      this.rrCount.set(ref, nextPosition + 1)
    }

    return result
  }

  // Backend with session affinity does not support round-robin
  private async nextWithAffinity(
    routes: Array<Route>,
    sessionAffinityRef: string
  ): Promise<Route> {
    const route = await this.store.get(sessionAffinityRef)

    if (route.length > 0) {
      return route[0]
    }

    const r = routes.sort((r1, r2) => r1.sessionCount - r2.sessionCount)[0]
    this.store.put(sessionAffinityRef, r)

    return r
  }
}

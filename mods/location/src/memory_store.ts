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
import { Route } from "@routr/common"
import { ILocatorStore } from "./types"
import { duplicateFilter, expiredFilter } from "./utils"

const MAX_CYCLES_BEFORE_CLEANUP = 10000

export default class MemoryStore implements ILocatorStore {
  private collections: Map<string, Route[]>
  private cleanupCount: number
  private maxCyclesBeforeCleanup: number

  constructor(maxCyclesBeforeCleanup: number = MAX_CYCLES_BEFORE_CLEANUP ) {
    this.collections = new Map<string, Route[]>()
    this.maxCyclesBeforeCleanup = maxCyclesBeforeCleanup
  }

  public put(key: string, route: Route): Promise<void> {
    const routes = [...this.collections.get(key) || []] 
 
    // Avoids duplicate or expired routes
    const filteredRoutes = routes
      .filter(expiredFilter)
      .filter(r => duplicateFilter(r, route))

    if (filteredRoutes.length > 0) {
      this.collections.set(key, [route, ...filteredRoutes])
    } else {
      this.collections.set(key, [route])
    }

    return
  }

  public get(key: string): Promise<Route[]> {
    // Cleanup every so often to avoid memory build up
    this.cleanupCount++
    if (this.cleanupCount >= this.maxCyclesBeforeCleanup) {
      this.cleanupCount = 0
      this.cleanup()
    }
    return Promise.resolve(this.collections.get(key) || [])
  }

  public delete(key: string): Promise<void> {
    this.collections.delete(key)
    return
  }

  public size() {
    return this.collections.size
  }

  public cleanup () {
    // Remove any expired route from collection
    this.collections.forEach((routes, key) => {
      const filteredRoutes = routes.filter(expiredFilter)
      if (filteredRoutes.length > 0) {
        this.collections.set(key, filteredRoutes)
      } else {
        this.collections.delete(key)
      }
    })
  }
}
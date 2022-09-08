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
import {IRegistryStore, RegistrationEntry} from "./types"

const MAX_CYCLES_BEFORE_CLEANUP = 10000

/**
 * In-memory store for the registry service.
 */
export default class MemoryStore implements IRegistryStore {
  private collections: Map<string, RegistrationEntry>
  private cleanupCount: number
  private maxCyclesBeforeCleanup: number

  /**
   * Creates a new in-memory store.
   *
   * @param {number} maxCyclesBeforeCleanup - Maximum number of cycles before cleanup
   */
  constructor(maxCyclesBeforeCleanup: number = MAX_CYCLES_BEFORE_CLEANUP) {
    this.collections = new Map<string, RegistrationEntry>()
    this.maxCyclesBeforeCleanup = maxCyclesBeforeCleanup
  }

  /** @inheritdoc */
  public put(key: string, entry: RegistrationEntry): Promise<void> {
    this.collections.set(key, entry)
    return
  }

  /** @inheritdoc */
  public list(): Promise<RegistrationEntry[]> {
    return Promise.resolve(
      this.collections.values ? Array.from(this.collections.values()) : []
    )
  }

  /** @inheritdoc */
  public get(key: string): Promise<RegistrationEntry> {
    // Cleanup every so often to avoid memory build up
    this.cleanupCount++
    if (this.cleanupCount >= this.maxCyclesBeforeCleanup) {
      this.cleanupCount = 0
      this.cleanup()
    }
    return Promise.resolve(this.collections.get(key))
  }

  /** @inheritdoc */
  public delete(key: string): Promise<void> {
    this.collections.delete(key)
    return
  }

  /** @inheritdoc */
  public cleanup(): void {
    // Remove all expired registration entries
    this.collections.forEach((entry, key) => {
      const timeElapsed = (Date.now() - entry.timeOfEntry) / 1000
      if (timeElapsed > entry.retentionTimeInSeconds)
        this.collections.delete(key)
    })
  }
}

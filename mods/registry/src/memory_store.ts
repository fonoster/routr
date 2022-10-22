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

const notExpired = (entry: RegistrationEntry) => {
  const timeElapsed = (Date.now() - entry.timeOfEntry) / 1000
  return timeElapsed <= entry.retentionTimeInSeconds
}

const MAX_CYCLES_BEFORE_CLEANUP = 10000

/**
 * In-memory store for the registry service.
 */
export default class MemoryStore implements IRegistryStore {
  private map: Map<string, RegistrationEntry>
  private cleanupCount: number
  private maxCyclesBeforeCleanup: number

  /**
   * Creates a new in-memory store.
   *
   * @param {number} maxCyclesBeforeCleanup - Maximum number of cycles before cleanup
   */
  constructor(maxCyclesBeforeCleanup: number = MAX_CYCLES_BEFORE_CLEANUP) {
    this.map = new Map<string, RegistrationEntry>()
    this.maxCyclesBeforeCleanup = maxCyclesBeforeCleanup
  }

  /** @inheritdoc */
  public put(key: string, entry: RegistrationEntry): Promise<void> {
    this.map.set(key, entry)

    // Cleanup every so often to avoid memory build up
    this.cleanupCount++
    if (this.cleanupCount >= this.maxCyclesBeforeCleanup) {
      this.cleanupCount = 0
      this.cleanup()
    }

    return
  }

  /** @inheritdoc */
  public list(): Promise<RegistrationEntry[]> {
    return Promise.resolve(
      this.map.values ? Array.from(this.map.values()).filter(notExpired) : []
    )
  }

  /** @inheritdoc */
  public get(key: string): Promise<RegistrationEntry> {
    const entry = this.map.get(key)
    if (entry && notExpired(entry)) {
      return Promise.resolve(entry)
    }
    return null
  }

  /** @inheritdoc */
  public delete(key: string): Promise<void> {
    this.map.delete(key)
    return
  }

  /** @inheritdoc */
  public cleanup(): void {
    // Remove all expired registration entries
    this.map.forEach((entry, key) => {
      if (!notExpired(entry)) {
        this.map.delete(key)
      }
    })
  }
}

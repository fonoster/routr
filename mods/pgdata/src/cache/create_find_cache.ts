/*
 * Copyright (C) 2026 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr.
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
import { FindCache, FindCacheOptions } from "./types"

const DEFAULT_MAX_ENTRIES = 100000
// Entries expire at a randomized time, so the ones loaded together don't all
// expire together and come back as one burst of queries
const TTL_JITTER = 0.2

const validOrThrow = (options: FindCacheOptions) => {
  const positive = (name: string, value: number) => {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${name} must be a positive number, got "${value}"`)
    }
  }
  positive("ttlSeconds", options.ttlSeconds)
  positive("negativeTtlSeconds", options.negativeTtlSeconds)
  if (options.maxEntries !== undefined)
    positive("maxEntries", options.maxEntries)
}

/**
 * The key a FindBy answer is kept under.
 *
 * @param {string} kind - the resource kind, as the service names it
 * @param {string} fieldName - the field searched
 * @param {unknown} fieldValue - the value searched for
 * @return {string} the key
 */
export const keyOf = (kind: string, fieldName: string, fieldValue: unknown) =>
  `${kind}|${fieldName}|${fieldValue}`

/**
 * Creates a cache for FindBy answers. An answer is served from memory until it
 * expires, one lookup at a time refills a key, and a write drops the written
 * row and every kind that embeds it.
 *
 * @param {FindCacheOptions} options - how long answers live and what embeds what
 * @return {FindCache} the cache
 */
export function createFindCache(options: FindCacheOptions): FindCache {
  validOrThrow(options)
  const now = options.now ?? Date.now
  const random = options.random ?? Math.random
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
  const embeddedBy = options.embeddedBy ?? {}
  const entries = new Map<string, { value: unknown; expiresAt: number }>()
  const inflight = new Map<string, Promise<unknown>>()
  // Bumped by every invalidation, so a load that began before one isn't kept
  let generation = 0

  const expiresAt = (ttlSeconds: number) =>
    now() + 1000 * ttlSeconds * (1 - TTL_JITTER + 2 * TTL_JITTER * random())

  const store = (key: string, value: unknown, ttlSeconds: number) => {
    if (entries.size >= maxEntries) {
      const current = now()
      entries.forEach((entry, k) => {
        if (entry.expiresAt <= current) entries.delete(k)
      })
    }
    // Full of live entries: serve this answer but don't keep it
    if (entries.size < maxEntries) {
      entries.set(key, { value, expiresAt: expiresAt(ttlSeconds) })
    }
  }

  const dropKind = (kind: string) => {
    const prefix = `${kind}|`
    entries.forEach((_, key) => {
      if (key.startsWith(prefix)) entries.delete(key)
    })
  }

  return {
    getOrLoad: async <T>(
      key: string,
      load: () => Promise<T>,
      isEmpty: (value: T) => boolean
    ): Promise<T> => {
      const hit = entries.get(key)
      if (hit && hit.expiresAt > now()) return hit.value as T

      const pending = inflight.get(key)
      if (pending) return pending as Promise<T>

      const startedAt = generation
      const loading = load()
        .then((value) => {
          if (startedAt === generation) {
            store(
              key,
              value,
              isEmpty(value) ? options.negativeTtlSeconds : options.ttlSeconds
            )
          }
          return value
        })
        .finally(() => inflight.delete(key))
      inflight.set(key, loading)
      return loading
    },
    invalidate: (kind: string, row: Record<string, unknown>) => {
      generation++
      Object.entries(row ?? {}).forEach(([field, value]) => {
        if (["string", "number", "boolean"].includes(typeof value)) {
          entries.delete(keyOf(kind, field, value))
        }
      })
      ;(embeddedBy[kind] ?? []).forEach(dropKind)
    },
    clear: () => {
      generation++
      entries.clear()
    },
    size: () => entries.size
  }
}

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
export interface FindCacheOptions {
  // How long a found answer lives, in seconds
  ttlSeconds: number
  // How long an empty answer lives: a new resource must show up soon
  negativeTtlSeconds: number
  maxEntries?: number
  // For each kind, the kinds whose answers embed it (all their entries go
  // when a row of that kind is written)
  embeddedBy?: Record<string, string[]>
  // Injected by tests
  now?: () => number
  random?: () => number
}

export interface FindCache {
  getOrLoad<T>(
    key: string,
    load: () => Promise<T>,
    isEmpty: (value: T) => boolean
  ): Promise<T>
  // A row of kind was written: its keys and every embedding kind are dropped
  invalidate(kind: string, row: Record<string, unknown>): void
  clear(): void
  size(): number
}

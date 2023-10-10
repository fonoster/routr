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
import { IRegistryStore, RegistrationEntry } from "./types"
import { createClient } from "redis"
import { Redis } from "@routr/common"
import { getLogger } from "@fonoster/logger"

const KEY_PREFIX = "registry"
const logger = getLogger({ service: "registry", filePath: __filename })

/**
 * Redis store for the registry service.
 */
export default class RedisStore implements IRegistryStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any

  /**
   * Creates a new redis store.
   *
   * @param {Redis.RedisStoreConfig} config - Optional store config
   */
  constructor(config?: Redis.RedisStoreConfig) {
    this.client = config
      ? createClient({ url: Redis.getRedisUrlFromConfig(config) })
      : createClient()
    this.client.connect()
    this.client.on("error", (err: unknown) =>
      logger.error("redis client error: ", err)
    )
  }

  /** @inheritdoc */
  public async put(key: string, entry: RegistrationEntry): Promise<void> {
    // Formatted the key to ensure it is unique
    await this.client.set(`${KEY_PREFIX}:${key}`, JSON.stringify(entry), {
      EX: entry.retentionTimeInSeconds
    })
    return
  }

  /** @inheritdoc */
  public async list(): Promise<RegistrationEntry[]> {
    const entries = []
    // eslint-disable-next-line no-loops/no-loops
    for await (const k of await this.client.scanIterator({
      CURSOR: 0,
      MATCH: `${KEY_PREFIX}:*`
    })) {
      entries.push(JSON.parse(await this.client.get(k)))
    }
    return entries
  }

  /** @inheritdoc */
  public async get(key: string): Promise<RegistrationEntry> {
    const rawEntry = await this.client.get(`${KEY_PREFIX}:${key}`)
    return rawEntry ? JSON.parse(rawEntry) : null
  }

  /** @inheritdoc */
  public async delete(key: string): Promise<void> {
    this.client.delete(`${KEY_PREFIX}:${key}`)
  }
}

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
import { createClient } from "redis"
import { Redis } from "@routr/common"
import { getLogger } from "@fonoster/logger"

const logger = getLogger({ service: "location", filePath: __filename })

/**
 * Redis store for the locator service.
 */
export default class RedisStore implements ILocatorStore {
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
  public async put(key: string, route: Route): Promise<void> {
    // Formatted the key to ensure it is unique
    await this.client.set(
      `${key}:${route.user}${route.host}${route.port}`,
      JSON.stringify(route),
      {
        EX: route.expires
      }
    )
    return
  }

  /** @inheritdoc */
  public async get(key: string): Promise<Route[]> {
    const routes = []
    // eslint-disable-next-line no-loops/no-loops
    for await (const k of await this.client.scanIterator({
      CURSOR: 0,
      MATCH: `${key}:*`
    })) {
      routes.push(JSON.parse(await this.client.get(k)))
    }
    return routes
  }

  /** @inheritdoc */
  public async delete(key: string): Promise<void> {
    // eslint-disable-next-line no-loops/no-loops
    for await (const k of await this.client.scanIterator({
      CURSOR: 0,
      MATCH: `${key}:*`
    })) {
      await this.client.del(k)
    }
    return
  }
}

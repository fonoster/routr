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
import {Route} from "@routr/common"
import {ILocatorStore, RedisStoreConfig} from "./types"
import {createClient} from "redis"
import {getUrlString} from "./utils"
import logger from "@fonoster/logger"

export default class RedisStore implements ILocatorStore {
  client: any

  constructor(config?: RedisStoreConfig) {
    this.client = config
      ? createClient({url: getUrlString(config)})
      : createClient()
    this.client.connect()
    this.client.on("error", (err: any) =>
      logger.error("redis client error: ", err)
    )
  }

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

  public async get(key: string): Promise<Route[]> {
    const routes = []
    for await (const k of await this.client.scanIterator({
      CURSOR: 0,
      MATCH: `${key}:*`
    })) {
      routes.push(JSON.parse(await this.client.get(k)))
    }
    return routes
  }

  public async delete(key: string): Promise<void> {
    for await (const k of await this.client.scanIterator({
      CURSOR: 0,
      MATCH: `${key}:*`
    })) {
      await this.client.del(k)
    }
    return
  }
}

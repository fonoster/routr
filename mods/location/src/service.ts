/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
import { CacheProvider, LocationConfig, RedisStoreConfig } from "./types"
import { createService } from "@routr/common"
import { configFromString, getServiceInfo } from "./utils"
import Location from "./location"
import MemoryStore from "./memory_store"
import RedisStore from "./redis_store"
import { getLogger } from "@fonoster/logger"

const logger = getLogger({ service: "location", filePath: __filename })

const allowedParameters = ["host", "port", "username", "password", "secure"]

/**
 * Creates a new locator service.
 *
 * @param {LocationConfig} config - Service configuration
 */
export default function LocationService(config: LocationConfig) {
  const { bindAddr, cache } = config
  let store

  if (cache.provider?.toUpperCase() === CacheProvider.REDIS) {
    store = new RedisStore(
      configFromString(
        cache.parameters,
        allowedParameters
      ) as unknown as RedisStoreConfig
    )
  } else {
    store = new MemoryStore()
  }

  createService(getServiceInfo(bindAddr, new Location(store)))

  logger.info(`using ${cache.provider} as cache provider`)
}

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
import {
  Backend,
  CACHE_PROVIDER,
  LocationConfig,
  RedisStoreConfig
} from "./types"
import {createService} from "@routr/common"
import {configFromString, getServiceInfo} from "./utils"
import Location from "./location"
import MemoryStore from "./memory_store"
import RedisStore from "./redis_store"
import logger from "@fonoster/logger"

const allowedParameters = ["host", "port", "username", "password", "secure"]

export default function LocationService(config: LocationConfig) {
  const {bindAddr, cache} = config
  let store

  if (cache.provider === CACHE_PROVIDER.REDIS) {
    store = new RedisStore(
      configFromString(
        cache.parameters,
        allowedParameters
      ) as any as RedisStoreConfig
    )
  } else {
    store = new MemoryStore()
  }

  const backends = new Map<string, Backend>()
  config.backends.forEach((b) => backends.set(`backend:${b.ref}`, b))
  createService(getServiceInfo(bindAddr, new Location(store, backends)))

  logger.info(`using ${cache.provider} as cache provider`)
}

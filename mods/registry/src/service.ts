/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
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
import {Transport} from "@routr/common"
import {sendRegisterMessage} from "./sender"
import createRegistrationRequest from "./request"
import {
  CACHE_PROVIDER,
  IRegistryStore,
  RedisStoreConfig,
  RegistryConfig
} from "./types"
import {configFromString, findTrunks} from "./utils"
import RedisStore from "./redis_store"
import MemoryStore from "./memory_store"
import {API as dataAPI} from "../../connect/src/api"
import {getLogger} from "@fonoster/logger"

const logger = getLogger({service: "registry", filePath: __filename})

const allowedParameters = ["host", "port", "username", "password", "secure"]
const DEFAULT_REGISTRATION_INTERVAL = 60000

// TODO:
// - Fix must decode JSON object from gRPC object
// - Fix not storing result on Store
// - Take allow parameters from config or enum list

// Lesser
// - Create Resource Trunk to RequestParams converter
// - Create selector Store selector
// - Find closest edgeport instead of [0]
// - Do retry with secondary uris if registration fails wit primary (Lets urgent)

/**
 * Loops through all the services and register them with the registry.
 *
 * @param {RegistryConfig} config
 */
export default function registryService(config: RegistryConfig) {
  logger.info("starting registry service")

  let store: IRegistryStore

  if (config.cache.provider === CACHE_PROVIDER.REDIS) {
    store = new RedisStore(
      configFromString(
        config.cache.parameters,
        allowedParameters
      ) as unknown as RedisStoreConfig
    )
  } else {
    store = new MemoryStore()
  }

  // Create internval to send registration request evert X seconds
  setInterval(async () => {
    logger.verbose("starting registration process")

    // eslint-disable-next-line new-cap
    logger.verbose("retrieving trunks from API")
    const trunks = await findTrunks(dataAPI(config.apiAddr))
    const registryInvocations = []

    logger.verbose(`found ${trunks.length} trunks`, {trunkCount: trunks.length})

    // eslint-disable-next-line no-loops/no-loops
    for (const t of trunks) {
      const trunk = {
        ref: t.metadata.ref,
        name: t.metadata.name,
        region: (t.metadata as any).region,
        host: "newyork1.voip.ms",
        port: 5060,
        username: "",
        secret: "",
        transport: "udp"
      }

      logger.verbose("trunk resource ref", {ref: t.metadata.ref})
      logger.verbose("trunk resource spec", {spec: t.spec})

      logger.verbose(
        `creating registration request for trunk ref ${t.metadata.ref}`,
        {
          name: t.metadata.name,
          host: trunk.host,
          port: trunk.port,
          transport: trunk.transport
        }
      )

      const request = createRegistrationRequest({
        user: trunk.username,
        targetDomain: trunk.host,
        targetAddress: `${trunk.host}:${trunk.port}`,
        proxyAddress: config.edgePorts[0].address,
        transport: Transport.TCP,
        allow: config.edgePorts[0].methods,
        auth: {
          username: trunk.username,
          secret: trunk.secret
        }
      })

      registryInvocations.push(
        sendRegisterMessage(config.requesterAddr)(request)
      )
    }

    const results = await Promise.all(registryInvocations)

    logger.verbose("registration process finished")

    // If result is error we register as an error
    // or otherwise we register as a success
    results.forEach((result) => {
      if (result instanceof Error) {
        // IDEA: This might a good place to change pointer to secondary URI
      } else {
        // store.put(result.ref, result)
      }
    })
  }, config.registerInterval * 1000 || DEFAULT_REGISTRATION_INTERVAL)
}

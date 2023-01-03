/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster
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
import { CommonConnect as CC } from "@routr/common"
import MemoryStore from "./memory_store"
import RedisStore from "./redis_store"
import {
  CacheProvider,
  IRegistryStore,
  RedisStoreConfig,
  RegistrationEntry,
  RegistryConfig,
  Trunk
} from "./types"

// eslint-disable-next-line require-jsdoc
export function getUnregisteredTrunks(store: IRegistryStore) {
  return async (trunks: Trunk[]): Promise<Trunk[]> => {
    const registryEntries = await store.list()
    return trunks?.filter(
      (t: Trunk) =>
        !registryEntries
          .map((r: RegistrationEntry) => r.trunkRef)
          .includes(t.ref)
    )
  }
}

// eslint-disable-next-line require-jsdoc
export async function findTrunks(apiClient: CC.APIClient) {
  return (
    await apiClient.trunks.findBy({
      fieldName: "sendRegister",
      fieldValue: "true"
    })
  ).items
}

export const configFromString = (
  params: string,
  allowedKeys: string[]
): Record<string, string | boolean> => {
  if (params.length === 0) return {}
  const parameters: Record<string, string | boolean> = {}
  params.split(",").forEach((par) => {
    try {
      const key = par.split("=")[0]
      const value = par.split("=")[1]
      if (allowedKeys.indexOf(key) === -1) {
        throw new Error(`invalid parameter: ${key}`)
      } else {
        parameters[key] = value === "true" ? true : value
      }
    } catch (e) {
      throw new Error(
        `invalid parameters string: ${params}; should be something like 'host=localhost,port=6379'`
      )
    }
  })
  return parameters
}

export const buildStore = (config: RegistryConfig) => {
  if (config.cache.provider === CacheProvider.REDIS) {
    const allowedParameters = ["host", "port", "username", "password", "secure"]
    return new RedisStore(
      configFromString(
        config.cache.parameters,
        allowedParameters
      ) as unknown as RedisStoreConfig
    )
  } else {
    return new MemoryStore()
  }
}

export const registrationRequestInputFromTrunk = (
  trunk: CC.Trunk,
  config: RegistryConfig
) => {
  const uri = trunk.uris[0]

  return {
    trunkRef: trunk.ref,
    user: uri.user,
    targetDomain: uri.host,
    targetAddress: `${uri.host}:${uri.port}`,
    // TODO: Find closest edgeport instead of [0]
    proxyAddress: config.edgePorts[0].address,
    transport: uri.transport,
    auth: {
      username: trunk.outboundCredentials?.username,
      secret: trunk.outboundCredentials?.password
    },
    methods: config.methods
  }
}

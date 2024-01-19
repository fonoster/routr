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
import { sendRegisterMessage } from "./sender"
import createRegistrationRequest from "./request"
import {
  DEFAULT_EXPIRES,
  IRegistryStore,
  RegistrationEntryStatus,
  RegistryConfig
} from "./types"
import {
  buildStore,
  findTrunks,
  registrationRequestInputFromTrunk
} from "./utils"
import {
  CommonConnect as CC,
  CommonErrors as CE,
  CommonTypes as CT
} from "@routr/common"
import { getLogger } from "@fonoster/logger"

const logger = getLogger({ service: "registry", filePath: __filename })

const DEFAULT_REGISTRATION_INTERVAL = 60

// TODO:
//  - We need to filter quarantine trunks from final list of trunks

/**
 * Loops through all the services and register them with the registry.
 *
 * @param {RegistryConfig} config
 */
export default function registryService(config: RegistryConfig) {
  logger.info("starting registry service")
  const store: IRegistryStore = buildStore(config)
  const dataAPI = CC.apiClient({ apiAddr: config.apiAddr })
  const registerInterval =
    config.registerInterval ?? DEFAULT_REGISTRATION_INTERVAL

  // Creates internval to send registration request every X seconds
  setInterval(async () => {
    logger.verbose("starting registration process")

    let trunks: CC.Trunk[] = []

    try {
      trunks = await findTrunks(dataAPI)
    } catch (err) {
      logger.error("failed to retrieve trunks from API", err)
      return
    }

    // Create a list of trunks in the Store
    const trunksInStore = (await store.list()).map((r) => r.trunkRef)

    const registryInvocations = trunks
      .filter((trunk) => !trunksInStore.includes(trunk.ref))
      .map(async (trunk) => {
        const registrationRequestInput = registrationRequestInputFromTrunk(
          trunk,
          config
        )
        const request = createRegistrationRequest(registrationRequestInput)
        return sendRegisterMessage(config.requesterAddr)(request)
      })

    const results = await Promise.allSettled(registryInvocations)

    results?.forEach(async (result) => {
      logger.silly("processing registration result", { result })

      if (result.status === "rejected") {
        logger.error("request rejected", result.reason)
        return
      }

      if (result.value instanceof CE.ServiceUnavailableError) {
        logger.error("service unavailable", result.value)
        return
      }

      const message = result.value.message as CT.SIPMessage

      // Makes sure we send register before the last register expires
      const retentionTime =
        (message.contact?.expires ??
          message.expires?.expires ??
          DEFAULT_EXPIRES) - registerInterval

      // TODO: Refactor to use ResponseType instead of string
      const status =
        message.responseType == CT.ResponseType.OK
          ? RegistrationEntryStatus.REGISTERED
          : RegistrationEntryStatus.QUARANTINE

      // Storing trunk in registry with status and retention time
      logger.verbose("storing trunk in registry", {
        trunkRef: result.value.trunkRef,
        status,
        retentionTime
      })

      store.put(result.value.trunkRef, {
        trunkRef: result.value.trunkRef,
        timeOfEntry: new Date().getTime(),
        retentionTimeInSeconds: retentionTime,
        status
      })
    })
  }, registerInterval * 1000)
}

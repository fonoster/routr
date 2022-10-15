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
import {sendRegisterMessage} from "./sender"
import createRegistrationRequest from "./request"
import {IRegistryStore, RegistrationEntryStatus, RegistryConfig} from "./types"
import {
  buildStore,
  convertResourceToTrunk,
  findTrunks,
  registrationRequestInputFromTrunk
} from "./utils"
import {CommonConnect as CC} from "@routr/common"
import {getLogger} from "@fonoster/logger"
import {SIPMessage} from "@routr/common/src/types"
import {ServiceUnavailableError} from "@routr/common"

const logger = getLogger({service: "registry", filePath: __filename})

const DEFAULT_REGISTRATION_INTERVAL = 60 * 1000
const DEFAULT_RETENTION_TIME = 600 * 1000

// TODO:
//  - We need to filter quarentine trunks from final list of trunks

/**
 * Loops through all the services and register them with the registry.
 *
 * @param {RegistryConfig} config
 */
export default function registryService(config: RegistryConfig) {
  logger.info("starting registry service")

  const store: IRegistryStore = buildStore(config)

  // Creates internval to send registration request every X seconds
  setInterval(async () => {
    logger.verbose("starting registration process")

    let resources: CC.Resource[] = []

    try {
      const dataAPI = CC.dataAPI(config.apiAddr)
      resources = await findTrunks(dataAPI)
    } catch (err) {
      logger.error("failed to retrieve trunks from API", err)
      return
    }

    const registryInvocations = resources.map((resource) => {
      const registrationRequestInput = registrationRequestInputFromTrunk(
        convertResourceToTrunk(resource),
        config
      )
      const request = createRegistrationRequest(registrationRequestInput)
      return sendRegisterMessage(config.requesterAddr)(request)
    })

    const results = await Promise.allSettled(registryInvocations)

    results?.forEach(async (result) => {
      logger.verbose("processing registration result", {result})

      if (result.status === "rejected") {
        logger.error("request rejected", result.reason)
        return
      }

      if (result.value instanceof ServiceUnavailableError) {
        logger.error("service unavailable", result.value)
        return
      }

      const message = result.value.message as SIPMessage
      const retentionTime = message.expires?.expires || DEFAULT_RETENTION_TIME
      // TODO: Refactor to use ResponseType instead of string
      const status =
        message.responseType.toString() == "OK"
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
  }, config.registerInterval * 1000 || DEFAULT_REGISTRATION_INTERVAL)
}

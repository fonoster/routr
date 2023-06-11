#!/usr/bin/env node
/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
import { getLogger } from "@fonoster/logger"
import { spawn } from "child_process"
import { connectProcessor } from "@routr/connect"
import { messageDispatcher } from "@routr/dispatcher"
import { locationService } from "@routr/location"
import { pgDataService as apiserver } from "@routr/pgdata"
import { rtprelay } from "@routr/rtprelay"
import { EDGEPORT_RUNNER } from "./envs"
import {
  connectConfig,
  dispatcherConfig,
  locationConfig,
  apiServerConfig,
  rtprelayConfig
} from "./configs"

const logger = getLogger({ service: "one", filePath: __filename })

logger.info("routr v2 // one distribution")

messageDispatcher(dispatcherConfig)
connectProcessor(connectConfig)
locationService(locationConfig)
apiserver(apiServerConfig)
rtprelay("0.0.0.0:51903", rtprelayConfig)

const edgeportProcess = spawn(EDGEPORT_RUNNER)

edgeportProcess.stdout.on("data", (data) => {
  process.stdout.write(`${data}`)
})

edgeportProcess.on("error", (err) => {
  logger.error(`failed to spawn edgeport process: ${err}`)
  process.exit(1)
})

edgeportProcess.on("exit", (code) => {
  if (code !== 0) {
    logger.error(`edgeport process exited with code ${code}`)
    process.exit(code)
  }
})

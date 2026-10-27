#!/usr/bin/env node
/*
 * Copyright (C) 2026 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
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
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("./tracer").init("one")
import { getLogger } from "@fonoster/logger"
import { spawn } from "child_process"
import { connectProcessor } from "@routr/connect"
import { messageDispatcher } from "@routr/dispatcher"
import { locationService } from "@routr/location"
import { pgDataService as apiserver } from "@routr/pgdata"
import { EDGEPORT_RUNNER, RTPENGINE_HOST, RTPRELAY_CONFIG_PATH } from "./envs"
import {
  connectConfig,
  dispatcherConfig,
  locationConfig,
  apiServerConfig,
  rtprelayConfig
} from "./configs"
import { loadOneConfig, resolveRecording } from "./config"

const logger = getLogger({ service: "one", filePath: __filename })

logger.info("routr v2 // all in one distribution")

if (RTPENGINE_HOST) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { rtprelay, getConfig } = require("@routr/rtprelay")

  // Only the profiles are taken from the file; the RTPEngine address comes
  // from the environment, as it always has in routr-one
  const result = getConfig(RTPRELAY_CONFIG_PATH)

  if (result._tag === "Left") {
    logger.error(result.left)
    process.exit(1)
  }

  if (result.right.source) {
    logger.info("loaded rtprelay configuration", { path: result.right.source })
  }

  rtprelay("0.0.0.0:51903", rtprelayConfig, result.right.profiles)

  // Add rtprelay middleware
  dispatcherConfig.middlewares.push({
    ref: "rtprelay-middleware",
    addr: "localhost:51903",
    postProcessor: true
  })
}

try {
  dispatcherConfig.recording = resolveRecording({
    env: { ...process.env },
    loadConfig: loadOneConfig,
    logger
  })
} catch (e) {
  logger.error((e as Error).message)
  process.exit(1)
}

messageDispatcher(dispatcherConfig)
connectProcessor(connectConfig)
locationService(locationConfig)
apiserver(apiServerConfig)

const edgeportProcess = spawn(EDGEPORT_RUNNER)

edgeportProcess.stdout.on("data", (data) => {
  process.stdout.write(`${data}`)
})

edgeportProcess.stderr.on("data", (data) => {
  process.stderr.write(`${data}`)
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

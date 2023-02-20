#!/usr/bin/env node
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
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("./tracer").init("dispatcher")
import registryService from "./service"
import { getConfig } from "./config/get_config"
import { getLogger } from "@fonoster/logger"
import { CONFIG_PATH, ENABLE_HEALTHCHECKS } from "./envs"
import express from "express"
const app = express()
const healthPort = 8080

const logger = getLogger({ service: "registry", filePath: __filename })
const config = getConfig(CONFIG_PATH)

if (config._tag === "Right") {
  registryService(config.right)
} else {
  logger.error(config.left)
}

if (ENABLE_HEALTHCHECKS) {
  app.get("/health", (_, res) => {
    res.send("OK")
  })

  app.listen(healthPort, () => {
    logger.info(`health check endpoint listening on port ${healthPort}`)
  })
}

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
require("./tracer").init("rtprelay")

import { getLogger } from "@fonoster/logger"
import {
  BIND_ADDR,
  CONFIG_PATH,
  DEFAULT_BIND_ADDR,
  DEFAULT_RTPENGINE_PORT,
  RTPENGINE_HOST,
  RTPENGINE_PORT
} from "./envs"
import { getConfig } from "./config/get_config"
import rtprelay from "./service"

const logger = getLogger({ service: "rtprelay", filePath: __filename })
const result = getConfig(CONFIG_PATH)

if (result._tag === "Right") {
  const config = result.right
  const host = RTPENGINE_HOST ?? config.rtpengine?.host

  if (!host) {
    logger.error(
      "the environment variable RTPENGINE_HOST is required unless the " +
        "configuration file sets spec.rtpengine.host"
    )
    process.exit(1)
  }

  if (config.source) {
    logger.info("loaded configuration file", { path: config.source })
  } else {
    logger.info("no configuration file, running with the default profiles")
  }

  rtprelay(
    BIND_ADDR ?? config.bindAddr ?? DEFAULT_BIND_ADDR,
    {
      host,
      port: RTPENGINE_PORT ?? config.rtpengine?.port ?? DEFAULT_RTPENGINE_PORT
    },
    config.profiles
  )
} else {
  logger.error(result.left)
}

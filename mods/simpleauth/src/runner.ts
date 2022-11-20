#!/usr/bin/env node
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
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("./tracer").init("simpleauth")
import simpleAuthProcessor from "./service"
import { User } from "./types"
import { Assertions as A } from "@routr/common"
import { getLogger } from "@fonoster/logger"

const logger = getLogger({ service: "simpleauth", filePath: __filename })

A.assertEnvsAreSet(["PATH_TO_AUTH"])

const whiteList = process.env.WHITELIST ? process.env.WHITELIST.split(",") : []

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const users: User[] = require(process.env.PATH_TO_AUTH)
  simpleAuthProcessor({
    bindAddr: process.env.BIND_ADDR || "0.0.0.0:51903",
    users,
    whiteList
  })
} catch (e) {
  if (e.code === "MODULE_NOT_FOUND") {
    logger.error(`auth file not found [path = ${process.env.PATH_TO_AUTH}]`)
  } else {
    logger.error(e)
  }
}

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
import logger from '@fonoster/logger'
import SimpleAuthProcessor from './service'
import { User } from './types'

if (!process.env.PATH_TO_AUTH) {
  logger.error("environment variable PATH_TO_AUTH is required but was not found")
  process.exit(1)
}

const whiteList = process.env.WHITELIST ? process.env.WHITELIST.split(',') : []

try {
  const users: User[] = require(process.env.PATH_TO_AUTH)
  SimpleAuthProcessor({ bindAddr: process.env.BIND_ADDR || "0.0.0.0:51903", users, whiteList })
} catch (e) {
  if (e.code === "MODULE_NOT_FOUND") {
    logger.error(`auth file not found [path = ${process.env.PATH_TO_AUTH}]`)
  } else {
    logger.error(e)
  }
}

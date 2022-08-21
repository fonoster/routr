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
require("./tracer").init("dispatcher")
// import registryService from "./service"
import {getConfig} from "./config/get_config"
import {Assertions as A, Method, Transport} from "@routr/common"
import {sendRegisterMessage} from "./sender"
import createRegistrationRequest from "./request"
import {getLogger} from "@fonoster/logger"

const logger = getLogger({service: "simpleauth", filePath: __filename})

A.assertEnvsAreSet(["CONFIG_PATH"])

const result = getConfig(process.env.CONFIG_PATH)

const req = createRegistrationRequest({
  user: "1001",
  targetDomain: "sipcd.camanio.com",
  targetAddress: "sipcd.camanio.com:5060",
  proxyAddress: "192.168.1.3:5060",
  transport: Transport.TCP,
  allow: [
    Method.INVITE,
    Method.ACK,
    Method.BYE,
    Method.CANCEL,
    Method.REGISTER,
    Method.OPTIONS
  ],
  auth: {
    username: "1001",
    secret: "1234"
  }
})

sendRegisterMessage("127.0.0.1:51909")(req)
  .then(logger.verbose)
  .catch(logger.error)

if (result._tag === "Right") {
  // locationService(result.right)
} else {
  logger.error(result.left)
}

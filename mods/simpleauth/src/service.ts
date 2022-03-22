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
import { calculateAuthResponse } from '@routr/common'
import { getCredentials, createUnauthorizedResponse } from './utils'
import Processor, { Response } from "@routr/processor"
import { User } from './types'

export default function SimpleAuthProcessor(config: { bindAddr: string, users: User[] }) {
  const { bindAddr, users } = config

  new Processor({ bindAddr, name: "simpleauth" })
    .listen((req: Record<string, any>, res: Response) => {
      //logger.verbose(JSON.stringify(req, null, ' '))
      logger.verbose("dbg000")
      // Calculate and return challenge
      if (req.message.authorization) {
        const auth = { ...req.message.authorization }
        auth.method = req.method
        // Calculate response and compare with the one send by the endpoint
        const calcRes = calculateAuthResponse(auth, getCredentials(auth.username, users))
        logger.verbose("dbg001")
        if (calcRes !== auth.response) {
          logger.verbose("dbg002")
          return res.send(createUnauthorizedResponse(auth.realm))
        }
      } else {
        logger.verbose("dbg003")
        return res.send(createUnauthorizedResponse(req.message.requestUri.host))
      }
      // Forward request to next middleware

      logger.verbose("yyy" + JSON.stringify(req, null, ' '))
      res.send(req)
    })
}

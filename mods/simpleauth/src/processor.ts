/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
 *
 * Licensed under the MIT License (the "License")
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
import {
  PROCESSOR_OBJECT_PROTO,
} from "@routr/common"
import logger from "@fonoster/logger"

const hasAutorization = (request: any) =>
  request.message.extensions.some((ext: any) => ext.name === 'Authorization')

// This processor returns upstream the message received
function getProcessor(pathToAuth: string) {
  return (call: any, callback: Function) => {
    if (!hasAutorization(call.request)) {
      callback(null, {
        message: {
          // UNAUTHORIZED
          response_type: 17,
          extensions: [
            {
              "name": "WWW-Authenticate",
              "value": "Digest realm=\"sip.local\",qop=\"auth\",opaque=\"\",stale=false,nonce=\"cd33803521f548a81f32942b3b9cf0\",algorithm=MD5"
            },
            {
              "name": "Expires",
              "value": "60"
            }
          ]
        }
      })
      return
    }

    logger.verbose("sending back response type OK")

    callback(null, {
      message: {
        response_type: 7
      }
    })
  }
}

export function getServiceInfo(params: { bindAddr: string, pathToAuth: string }) {
  const { bindAddr, pathToAuth } = params
  return {
    name: "simpleauth",
    bindAddr,
    service: PROCESSOR_OBJECT_PROTO.Processor.service,
    handlers: { processMessage: getProcessor(pathToAuth) }
  }
}


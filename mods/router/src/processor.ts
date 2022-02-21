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
import { findMatch } from "./find_match"
import { ProcessorConfig } from "./types"

export interface ProcessorGPRCConnection {
  processMessage: (request: unknown, callback: Function) => void
}

export default function processor(configList: Array<ProcessorConfig>, 
  connections: Map<string, ProcessorGPRCConnection>) {
  return async(call: any, callback: Function): Promise<void> => {
    const matchResult = findMatch(configList)(call.request)
    if ('ref' in matchResult) {
      const conn = connections.get(matchResult.ref)
      conn.processMessage(call.request, (err: Error, response: any) => {
        callback(err, response)
      })
    } else {
      callback(matchResult)
    }
  }
}

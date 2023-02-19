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
import { HeaderModifier, HeaderModifierAction, ResponseType } from "../types"

export const CodeToResponseTypeMap = {
  401: ResponseType.UNAUTHORIZED,
  403: ResponseType.FORBIDDEN,
  500: ResponseType.SERVER_ERROR
}

export interface ConnectError {
  code: keyof typeof CodeToResponseTypeMap
  reason?: string
  headers: HeaderModifier[]
}

export const convertToErrorResponse = (connectError: ConnectError) => {
  return {
    message: {
      responseType: CodeToResponseTypeMap[connectError.code],
      reasonPhrase: connectError.reason,
      extensions: connectError.headers.map((modifier) => {
        if (modifier.action === HeaderModifierAction.ADD) {
          return {
            name: modifier.name,
            value: modifier.value
          }
        }
      })
    }
  }
}

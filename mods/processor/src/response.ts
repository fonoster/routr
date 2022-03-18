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
import { MessageRequest } from "@routr/common"

const buildResponse = (code: number) => {
  return { message: { response_type: code }}
}

export default class Response {
  callback: any;
  constructor(callback: Function) {
    this.callback = callback
  }

  sendOk() {
    this.callback(null, buildResponse(7))
  }

  sendMethodNotAllowed() {
    this.callback(null, buildResponse(21))
  }

  sendNotImplemented() {
    this.callback(null, buildResponse(47))
  }

  send(message: MessageRequest | Record<string, unknown>) {
    this.callback(null, message)
  }

  sendError(error: any) {
    this.callback(error, null)
  }
}

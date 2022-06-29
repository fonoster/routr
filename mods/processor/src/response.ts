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
import {MessageRequest} from "@routr/common"

const buildResponse = (
  code: number,
  extraHeaders?: Array<{name: string; value: string}>
) => {
  return {message: {responseType: code, extensions: extraHeaders}}
}

/**
 * Response object.
 */
export default class Response {
  callback: (call: unknown, response: unknown) => void

  /**
   * Creates a new Response object.
   *
   * @param {GrpcCallback} callback - The callback to be called when the response is ready.
   */
  constructor(callback: (call: unknown, response: unknown) => void) {
    this.callback = callback
  }

  /**
   * Sends an OK response.
   *
   * @param {object[]} extraHeaders - Optional extra headers to be sent.
   */
  sendOk(extraHeaders?: Array<{name: string; value: string}>) {
    this.callback(null, buildResponse(7, extraHeaders))
  }

  /**
   * Sends a method not allowed response.
   */
  sendMethodNotAllowed() {
    this.callback(null, buildResponse(21))
  }

  /**
   * Sends a not found response.
   */
  sendNotFound() {
    this.callback(null, buildResponse(20))
  }

  /**
   * Sends a not implemented response.
   */
  sendNotImplemented() {
    this.callback(null, buildResponse(47))
  }

  /**
   * Sends a response with a SIP Message.
   *
   * @param {MessageRequest} message - The request message. Accepts MessageRequest or a Record.
   */
  send(message: MessageRequest | Record<string, unknown>) {
    this.callback(null, message)
  }

  /**
   * Sends an error response.
   *
   * @param {Error} error - The error to be sent.
   */
  sendError(error: Error) {
    this.callback(error, null)
  }
}

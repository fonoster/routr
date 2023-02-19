/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
import * as grpc from "@grpc/grpc-js"

/**
 * Thrown when no backened matches the request.
 */
export class NotMatchingProcessorFound extends Error {
  code: grpc.status

  /**
   * Creates a new instance of NotMatchingProcessorFound.
   *
   * @param {string} ref - The reference of the processor
   */
  constructor(ref: string) {
    super(`not matching processor found for request ref: ${ref}`)
    this.code = grpc.status.NOT_FOUND
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, NotMatchingProcessorFound.prototype)
  }
}

/**
 * Thrown when the processor is not available.
 */
export class ProcessorUnavailableError extends Error {
  code: number

  /**
   * Creates a new instance of NotMatchingProcessorFound.
   *
   * @param {string} ref - The reference of the processor
   */
  constructor(ref: string) {
    super(`processor ref = ${ref} is unavailable`)
    this.code = grpc.status.UNAVAILABLE
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, ProcessorUnavailableError.prototype)
  }
}

/**
 * Thrown when the middleware is not available.
 */
export class MiddlewareUnavailableError extends Error {
  code: number

  /**
   * Creates a new instance of NotMatchingProcessorFound.
   *
   * @param {string} ref - The reference of the processor
   */
  constructor(ref: string) {
    super(`middleware ref = ${ref} is unavailable`)
    this.code = grpc.status.UNAVAILABLE
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, MiddlewareUnavailableError.prototype)
  }
}

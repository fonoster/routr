/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster
 *
 * This file is part of nodejs-service
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
import * as grpc from "@grpc/grpc-js"

/**
 * Thrown for unimplemented handlers.
 */
export class UnimplementedError extends Error {
  code: number

  /**
   * Creates an instance of UnimplementedError.
   */
  constructor() {
    super(
      "this operation is not supported/enabled in this data api implementation."
    )
    this.code = grpc.status.UNIMPLEMENTED
    Object.setPrototypeOf(this, UnimplementedError.prototype)
  }
}

/**
 * Thrown if the resource is not found.
 */
export class ResourceNotFound extends Error {
  code: number

  /**
   * Creates an instance of UnimplementedError.
   *
   * @param {string} ref - the reference of the resource
   */
  constructor(ref: string) {
    super(`resource not found: ${ref}`)
    this.code = grpc.status.NOT_FOUND
    Object.setPrototypeOf(this, ResourceNotFound.prototype)
  }
}

/**
 * Thrown if the request is invalid.
 */
export class BadRequest extends Error {
  code: number

  /**
   * Creates an instance of UnimplementedError.
   *
   * @param {string} message - optional message with the error. Defaults to "bad request."
   */
  constructor(message?: string) {
    super(message ?? "bad request")
    this.code = grpc.status.INVALID_ARGUMENT
    Object.setPrototypeOf(this, BadRequest.prototype)
  }
}

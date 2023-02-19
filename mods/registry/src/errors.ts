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

export type InvalidConfiguration = InvalidSchemaConfiguration

/**
 * Error thrown when the Registry service finds a bad configuration.
 */
export class InvalidSchemaConfiguration extends Error {
  code: grpc.status

  /**
   * Create a new InvalidSchemaConfiguration error.
   *
   * @param {string} msg - Message from the validation error
   */
  constructor(msg: string) {
    super(msg)
    this.code = grpc.status.INVALID_ARGUMENT
    Object.setPrototypeOf(this, InvalidSchemaConfiguration.prototype)
  }
}

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
import * as grpc from "@grpc/grpc-js"
import {ROUTING_DIRECTION} from "./types"

/**
 * Throw when the API server is unavailable.
 */
export class ServiceUnavailableError extends Error {
  code: number

  /**
   * Create a new ServiceUnavailableError.
   *
   * @param {string} message - The error message
   */
  constructor(message: string) {
    super(message)
    this.code = grpc.status.UNAVAILABLE
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype)
  }
}

/**
 * Throw when the route is not supported.
 */
export class UnsuportedRoutingError extends Error {
  code: number

  /**
   * Create a new ServiceUnavailableError.
   *
   * @param {string} routingDir - The routing direction
   */
  constructor(routingDir: ROUTING_DIRECTION) {
    super("unsupported routing direction: " + routingDir)
    this.code = grpc.status.UNKNOWN
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype)
  }
}

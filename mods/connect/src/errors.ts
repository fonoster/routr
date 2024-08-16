/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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
import { RoutingDirection } from "./types"

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
export class UnsupportedRoutingError extends Error {
  code: number

  /**
   * Create a new ServiceUnavailableError.
   *
   * @param {RoutingDirection} routingDirection - The routing direction
   */
  constructor(routingDirection: RoutingDirection) {
    super("unsupported routing direction: " + routingDirection)
    this.code = grpc.status.UNIMPLEMENTED
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype)
  }
}

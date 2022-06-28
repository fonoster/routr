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
import grpc = require("@grpc/grpc-js")

/**
 * Error thrown if the definition for a service is not found.
 */
export class ServiceDefinitionNotFound extends Error {
  /**
   * Constructs a new ServiceDefinitionNotFound error.
   *
   * @param {string} name - The name of the service definition.
   * @param {string} version - The version of the service definition.
   */
  constructor(name: string, version: string) {
    super(`Service definition for ${name}/${version} not found`)
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, ServiceDefinitionNotFound.prototype)
  }
}

/**
 * Error thrown if the service is not available.
 */
export class ServiceUnavailableError extends Error {
  code: number

  /**
   * Constructs a new ServiceUnavailableError error.
   *
   * @param {string} address - The address of the service.
   */
  constructor(address: string) {
    super(`service unavailable [service address = ${address}]`)
    this.code = grpc.status.UNAVAILABLE
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype)
  }
}

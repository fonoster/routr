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
 * Error thrown if the definition for a service is not found.
 */
export class ServiceDefinitionNotFoundError extends Error {
  /**
   * Constructs a new ServiceDefinitionNotFound error.
   *
   * @param {string} name - The name of the service definition.
   * @param {string} version - The version of the service definition.
   */
  constructor(name: string, version: string) {
    super(`service definition for ${name}/${version} not found`)
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, ServiceDefinitionNotFoundError.prototype)
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

/**
 * Error thrown if the client cannot connect to the service.
 */
export class ClientConnectionError extends Error {
  /**
   * Constructs a new ClientConnectionError error.
   * @param {string} address - The address of the service.
   * @param {boolean} isSecure - Whether the connection is secure.
   */
  constructor(address: string, isSecure: boolean) {
    super(
      `cannot connect to service [service address = ${address}, tlsOn = ${isSecure}]`
    )
  }
}

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
export class ResourceNotFoundError extends Error {
  code: number

  /**
   * Creates an instance of UnimplementedError.
   *
   * @param {string} ref - the reference of the resource
   */
  constructor(ref: string) {
    super(`resource not found: ${ref}`)
    this.code = grpc.status.NOT_FOUND
    Object.setPrototypeOf(this, ResourceNotFoundError.prototype)
  }
}

/**
 * Thrown if the request is invalid.
 */
export class BadRequestError extends Error {
  code: number

  /**
   * Creates an instance of UnimplementedError.
   *
   * @param {string} message - optional message with the error. Defaults to "bad request."
   */
  constructor(message?: string) {
    super(message ?? "bad request")
    this.code = grpc.status.INVALID_ARGUMENT
    Object.setPrototypeOf(this, BadRequestError.prototype)
  }
}

/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
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
import { APIClient } from "../client"
import { ClientOptions } from "../types"
import {
  CreateCredentialsRequest,
  CreateCredentialsResponse,
  GetCredentialsResponse,
  ListCredentialsRequest,
  ListCredentialsResponse,
  UpdateCredentialsRequest,
  UpdateCredentialsResponse
} from "./types"

/**
 * @classdesc Use Routr Credentials, a capability of Routr SIP Proxy, to create, update, get
 * and delete Credentials. The Credentials API requires of a running Routr deployment.
 *
 * @extends APIClient
 * @example
 *
 * const SDK = require("@routr/sdk")
 * const credentials = new SDK.Credentials()
 *
 * const request = {
 *   name: "Credentials for John Doe",
 *   username: "jdoe",
 *   password: "123456",
 *   extended: {
 *     "key": "value"
 *   }
 * }
 *
 * credentials.createCredentials(request)
 *   .then(console.log)
 *   .catch(console.error)   // an error occurred
 */
export class Credentials extends APIClient {
  /**
   * Constructs a new Credentials API object.
   *
   * @param {ClientOptions} options - Options to indicate the objects endpoint
   * @see module:core:APIClient
   */
  constructor(options: ClientOptions) {
    super(options)
  }

  /**
   * Creates a new Credentials on Routr.
   *
   * @param {CreateCredentialsRequest} request - The request to create an Credentials
   * @param {string} request.name - The friendly name of the Credentials
   * @param {string} request.username - Username of the Credentials
   * @param {string} request.password - Password of the Credentials
   * @param {Object} request.extended - Optional extended attributes
   * @return {Promise<CreateCredentialsResponse>} The newly created Credentials
   * @throws if request is null
   * @example
   *
   * const request = {
   *   name: "Credentials for John Doe",
   *   username: "jdoe",
   *   password: "123456",
   *   extended: {
   *     "key": "value"
   *   }
   * }
   *
   * credentials.createCredentials(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async createCredentials(
    request: CreateCredentialsRequest
  ): Promise<CreateCredentialsResponse> {
    return this.client.credentials.create(request)
  }

  /**
   * Updates an already existing Credentials on Routr.
   *
   * @param {UpdateCredentialsRequest} request - Partial with the fields to update
   * @param {string} request.name - The friendly name of the Credentials
   * @param {string} request.username - Username of the Credentials
   * @param {string} request.password - Password of the Credentials
   * @param {Object} request.extended - Optional extended attributes
   * @return {Promise<UpdateCredentialsResponse>} The updated Credentials
   * @example
   *
   * const request = {
   *   ref: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
   *   name: "John Doe's Credentials"
   * }
   *
   * credentials.updateCredentials(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async updateCredentials(
    request: UpdateCredentialsRequest
  ): Promise<UpdateCredentialsResponse> {
    return this.client.credentials.update(request)
  }

  /**
   * Gets an Credentials from Routr.
   *
   * @param {string} ref - The Credentials's reference
   * @return {Promise<GetCredentialsResponse>} The Credentials
   * @example
   *
   * const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
   *
   * credentials.getCredentials(ref)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async getCredentials(ref: string): Promise<GetCredentialsResponse> {
    return this.client.credentials.get(ref)
  }

  /**
   * Deletes an Credentials from Routr.
   *
   * @param {string} ref - The Credentials's reference
   * @return {Promise<void>}
   * @example
   *
   * const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
   *
   * credentials.deleteCredentials(ref)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async deleteCredentials(ref: string): Promise<void> {
    return this.client.credentials.del(ref)
  }

  /**
   * Lists all Credentials from Routr with pagination.
   *
   * @param {ListCredentialsRequest} request - The request to list Credentials
   * @param {number} request.pageSize - The number of Credentials to return
   * @param {string} request.pageToken - The page token to use for pagination
   * @return {Promise<ListCredentialsResponse>} The list of Credentials in the current page
   * @example
   *
   * const request = {
   *  pageSize: 10
   * }
   *
   * credentials.listCredentials(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async listCredentials(
    request: ListCredentialsRequest
  ): Promise<ListCredentialsResponse> {
    return this.client.credentials.list(request)
  }
}

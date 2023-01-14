/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster
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
  CreateNumberRequest,
  CreateNumberResponse,
  GetNumberResponse,
  ListNumberRequest,
  ListNumberResponse,
  UpdateNumberRequest,
  UpdateNumberResponse
} from "./types"

/**
 * @classdesc Use Routr Numbers, a capability of Routr SIP Proxy, to create, update, get
 * and delete Numbers. The Number API requires of a running Routr deployment.
 *
 * @extends APIClient
 * @example
 *
 * const SDK = require("@routr/sdk")
 * const numbers = new SDK.Numbers()
 *
 * const request = {
 *   name: "(415) 555-1212",
 *   telUrl: "teL:+14155551212",
 *   aorLink: "sip:100@sip.local",
 *   city: "San Francisco",
 *   country: "United States",
 *   countryISOCode: "US",
 *   sessionAffinityHeader: "X-Room-Id"
 *   extraHeaders: [{
 *     name: "X-Room-Id",
 *     value: "abc-us-123"
 *   }],
 *   extended: {
 *     "key": "value"
 *   }
 * }
 *
 * numbers.createNumber(request)
 *   .then(console.log)
 *   .catch(console.error)   // an error occurred
 */
export class Numbers extends APIClient {
  /**
   * Constructs a new Number API object.
   *
   * @param {ClientOptions} options - Options to indicate the objects endpoint
   * @see module:core:APIClient
   */
  constructor(options: ClientOptions) {
    super(options)
  }

  /**
   * Creates a new Number on Routr.
   *
   * @param {CreateNumberRequest} request - The request to create an Number
   * @param {string} request.name - Name of the Number
   * @param {string} request.telUrl - The number URI to be used (e.g. te:+1234567890)
   * @param {string} request.aorLink - The AOR link to be used (e.g. sip:1001@sip.local)
   * @param {string} request.city - The city where the number is located
   * @param {string} request.country - The country where the number is located
   * @param {string} request.countryISOCode - The country ISO code where the number is located
   * @param {{ name: string, value: string}[]} request.extraHeaders - Extra headers to be used
   * @param {string} request.trunkRef - The trunk reference to be used
   * @param {string} request.sessionAffinityHeader - Optional session affinity header
   * @param {string} request.extended - Optional extended attributes
   * @return {Promise<CreateNumberResponse>} The newly created Number
   * @throws if request is null
   * @example
   *
   * const request = {
   *   name: "(415) 555-1212",
   *   telUrl: "teL:+14155551212",
   *   aorLink: "sip:100@sip.local",
   *   city: "San Francisco",
   *   country: "United States",
   *   countryISOCode: "US",
   *   sessionAffinityHeader: "X-Room-Id"
   *   extraHeaders: [{
   *     name: "X-Room-Id",
   *     value: "abc-us-123"
   *   }],
   *   extended: {
   *     "key": "value"
   *   }
   * }
   *
   * numbers.createNumber(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async createNumber(
    request: CreateNumberRequest
  ): Promise<CreateNumberResponse> {
    return this.client.numbers.create(request)
  }

  /**
   * Updates an already existing Number on Routr.
   *
   * @param {UpdateNumberRequest} request - Partial with the fields to update
   * @param {string} request.name - Name of the Number
   * @param {string} request.telUrl - The number URI to be used (e.g. te:+1234567890)
   * @param {string} request.aorLink - The AOR link to be used (e.g. sip:1001@sip.local)
   * @param {string} request.city - The city where the number is located
   * @param {string} request.country - The country where the number is located
   * @param {string} request.countryISOCode - The country ISO code where the number is located
   * @param {{ name: string, value: string}[]} request.extraHeaders - Extra headers to be used
   * @param {string} request.trunkRef - The trunk reference to be used
   * @param {string} request.sessionAffinityHeader - Optional session affinity header
   * @param {string} request.extended - Optional extended attributes
   * @return {Promise<UpdateNumberResponse>} The updated Number
   * @example
   *
   * const request = {
   *   name: "(415) 555-1212 (friendly name)",
   *   aorLink: "sip:2001@sip.local"
   * }
   *
   * numbers.updateNumber(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async updateNumber(
    request: UpdateNumberRequest
  ): Promise<UpdateNumberResponse> {
    return this.client.numbers.update(request)
  }

  /**
   * Gets a Number from Routr.
   *
   * @param {string} ref - The Number's reference
   * @return {Promise<GetNumberResponse>} The Number
   * @example
   *
   * const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
   *
   * numbers.getNumber(ref)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async getNumber(ref: string): Promise<GetNumberResponse> {
    return this.client.numbers.get(ref)
  }

  /**
   * Deletes a Number from Routr.
   *
   * @param {string} ref - The Number's reference
   * @return {Promise<void>}
   * @example
   *
   * const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
   *
   * numbers.deleteNumber(ref)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async deleteNumber(ref: string): Promise<void> {
    return this.client.numbers.del(ref)
  }

  /**
   * Lists all Numbers from Routr with pagination.
   *
   * @param {ListNumberRequest} request - The request to list Numbers
   * @param {number} request.pageSize - The number of Numbers to return
   * @param {string} request.pageToken - The page token to use for pagination
   * @return {Promise<ListNumberResponse>} The list of Numbers
   * @example
   *
   * const request = {
   *  pageSize: 10
   * }
   *
   * numbers.listNumbers(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async listNumbers(request: ListNumberRequest): Promise<ListNumberResponse> {
    return this.client.numbers.list(request)
  }
}

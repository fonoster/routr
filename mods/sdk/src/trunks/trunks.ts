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
  CreateTrunkRequest,
  CreateTrunkResponse,
  GetTrunkResponse,
  ListTrunkRequest,
  ListTrunkResponse,
  UpdateTrunkRequest,
  UpdateTrunkResponse
} from "./types"

/**
 * @classdesc Use Routr Trunks, a capability of Routr SIP Proxy, to create, update, get
 * and delete Trunks. The Trunks API requires of a running Routr deployment.
 *
 * @extends APIClient
 * @example
 *
 * const SDK = require("@routr/sdk")
 * const trunks = new SDK.Trunks()
 *
 * const request = {
 *   name: "Trunk from Twilio",
 *   inboundUri: "sip:twilio.sip.acme.io",
 *   accessControlListRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
 *   inboundCredentialsRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
 *   outboundCredentialsRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
 *   uris: [{
 *     host: "acme.sip.twilio.com",
 *     port: 5060,
 *     transport: "udp",
 *     user: "AC1234567890",
 *     weight: 1,
 *     priority: 1
 *   }],
 *   extended: {
 *     "key": "value"
 *   }
 * }
 *
 * trunks.createTrunk(request)
 *   .then(console.log)
 *   .catch(console.error)   // an error occurred
 */
export class Trunks extends APIClient {
  /**
   * Constructs a new Trunk API object.
   *
   * @param {ClientOptions} options - Options to indicate the objects endpoint
   * @see module:core:APIClient
   */
  constructor(options: ClientOptions) {
    super(options)
  }

  /**
   * Creates a new Trunk on Routr.
   *
   * @param {CreateTrunkRequest} request - The request to create an Trunk
   * @param {string} request.name - Name of the Trunk
   * @param {string} request.inboundUri - Inbound URI of the Trunk
   * @param {string} request.accessControlListRef - Access Control List reference
   * @param {string} request.inboundCredentialsRef - The reference of the inbound credentials
   * @param {string} request.outboundCredentialsRef - The reference of the outbound credentials
   * @param {TrunkURI[]} request.uris - The outbound URIs of the Trunk
   * @return {Promise<CreateTrunkResponse>} The newly created Trunk
   * @throws if request is null
   * @example
   *
   * const request = {
   *   name: "Trunk from Twilio",
   *   inboundUri: "sip:twilio.sip.acme.io",
   *   accessControlListRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
   *   inboundCredentialsRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
   *   outboundCredentialsRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
   *   uris: [{
   *     host: "acme.sip.twilio.com",
   *     port: 5060,
   *     transport: "udp",
   *     user: "AC1234567890",
   *     weight: 1,
   *     priority: 1
   *   }],
   *   extended: {
   *     "key": "value"
   *   }
   * }
   *
   * trunks.createTrunk(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async createTrunk(request: CreateTrunkRequest): Promise<CreateTrunkResponse> {
    return this.client.trunks.create(request)
  }

  /**
   * Updates an already existing Trunk on Routr.
   *
   * @param {UpdateTrunkRequest} request - Partial with the fields to update
   * @param {string} request.name - Name of the Trunk
   * @param {string} request.inboundUri - Inbound URI of the Trunk
   * @param {string} request.accessControlListRef - Access Control List reference
   * @param {string} request.inboundCredentialsRef - The reference of the inbound credentials
   * @param {string} request.outboundCredentialsRef - The reference of the outbound credentials
   * @param {TrunkURI[]} request.uris - The outbound URIs of the Trunk
   * @param {Object} request.extended - Optional extended attributes
   * @return {Promise<UpdateTrunkResponse>} The updated Trunk
   * @example
   *
   * const request = {
   *   ref: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
   *   name: "Trunk from Twilio (US-East)",
   * }
   *
   * trunks.updateTrunk(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async updateTrunk(request: UpdateTrunkRequest): Promise<UpdateTrunkResponse> {
    return this.client.trunks.update(request)
  }

  /**
   * Gets an Trunk from Routr.
   *
   * @param {string} ref - The Trunk's reference
   * @return {Promise<GetTrunkResponse>} The Trunk
   * @example
   *
   * const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
   *
   * trunks.getTrunk(ref)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async getTrunk(ref: string): Promise<GetTrunkResponse> {
    return this.client.trunks.get(ref)
  }

  /**
   * Deletes an Trunk from Routr.
   *
   * @param {string} ref - The Trunk's reference
   * @return {Promise<void>}
   * @example
   *
   * const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
   *
   * trunks.deleteTrunk(ref)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async deleteTrunk(ref: string): Promise<void> {
    return this.client.trunks.del(ref)
  }

  /**
   * Lists all Trunks from Routr with pagination.
   *
   * @param {ListTrunkRequest} request - The request to list Trunks
   * @param {number} request.pageSize - The number of Trunks to return
   * @param {string} request.pageToken - The page token to use for pagination
   * @return {Promise<ListTrunkResponse>} The list of Trunks in the current page
   * @example
   *
   * const request = {
   *  pageSize: 10
   * }
   *
   * trunks.listTrunks(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async listTrunks(request: ListTrunkRequest): Promise<ListTrunkResponse> {
    return this.client.trunks.list(request)
  }
}

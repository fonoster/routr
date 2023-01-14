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
  CreateDomainRequest,
  CreateDomainResponse,
  GetDomainResponse,
  ListDomainRequest,
  ListDomainResponse,
  UpdateDomainRequest,
  UpdateDomainResponse
} from "./types"

/**
 * @classdesc Use Routr Domains, a capability of Routr SIP Proxy, to create, update, get
 * and delete Domains. The Domains API requires of a running Routr deployment.
 *
 * @extends APIClient
 * @example
 *
 * const SDK = require("@routr/sdk")
 * const domains = new SDK.Domains()
 *
 * const request = {
 *   name: "Local domain",
 *   domainUri: "sip.local",
 *   accessControlListRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
 *   egressPolicies: [{
 *     rule: ".*",
 *     numberRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
 *   }],
 *   extended: {
 *     "key": "value"
 *   }
 * }
 *
 * domains.createDomain(request)
 *   .then(console.log)
 *   .catch(console.error)   // an error occurred
 */
export class Domains extends APIClient {
  /**
   * Constructs a new Domain API object.
   *
   * @param {ClientOptions} options - Options to indicate the objects endpoint
   * @see module:core:APIClient
   */
  constructor(options: ClientOptions) {
    super(options)
  }

  /**
   * Creates a new Domain on Routr.
   *
   * @param {CreateDomainRequest} request - The request to create an Domain
   * @param {string} request.name - Name of the Domain
   * @param {string} request.domainUri - The FQDN of the Domain
   * @param {string} request.accessControlListRef - The reference to the AccessControlList for the Domain
   * @param {CC.EgressPolicy[]} request.egressPolicies - The list of EgressPolicies for the Domain
   * @param {string} request.extended - Optional extended attributes
   * @return {Promise<CreateDomainResponse>} The newly created Domain
   * @throws if request is null
   * @example
   *
   * const request = {
   *   name: "Local domain",
   *   domainUri: "sip.local",
   *   accessControlListRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
   *   egressPolicies: [{
   *     rule: ".*",
   *     numberRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
   *   }],
   *   extended: {
   *     "key": "value"
   *   }
   * }
   *
   * domains.createDomain(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async createDomain(
    request: CreateDomainRequest
  ): Promise<CreateDomainResponse> {
    return this.client.domains.create(request)
  }

  /**
   * Updates an already existing Domain on Routr.
   *
   * @param {UpdateDomainRequest} request - Partial with the fields to update
   * @param {string} request.name - Name of the Domain
   * @param {string} request.domainUri - The FQDN of the Domain
   * @param {string} request.accessControlListRef - The reference to the AccessControlList for the Domain
   * @param {CC.EgressPolicy[]} request.egressPolicies - The list of EgressPolicies for the Domain
   * @param {string} request.extended - Optional extended attributes
   * @return {Promise<UpdateDomainResponse>} The updated Domain
   * @example
   *
   * const request = {
   *   name: "Local domain updated",
   *   accessControlListRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
   * }
   *
   * domains.updateDomain(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async updateDomain(
    request: UpdateDomainRequest
  ): Promise<UpdateDomainResponse> {
    return this.client.domains.update(request)
  }

  /**
   * Gets a Domain from Routr.
   *
   * @param {string} ref - The Domain's reference
   * @return {Promise<GetDomainResponse>} The Domain
   * @example
   *
   * const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
   *
   * domains.getDomain(ref)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async getDomain(ref: string): Promise<GetDomainResponse> {
    return this.client.domains.get(ref)
  }

  /**
   * Deletes a Domain from Routr.
   *
   * @param {string} ref - The Domain's reference
   * @return {Promise<void>}
   * @example
   *
   * const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
   *
   * domains.deleteDomain(ref)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async deleteDomain(ref: string): Promise<void> {
    return this.client.domains.del(ref)
  }

  /**
   * Lists all Domains from Routr with pagination.
   *
   * @param {ListDomainRequest} request - The request to list Domains
   * @param {number} request.pageSize - The number of Domains to return
   * @param {string} request.pageToken - The page token to use for pagination
   * @return {Promise<ListDomainResponse>} The list of Domains
   * @example
   *
   * const request = {
   *   pageSize: 10
   * }
   *
   * domains.listDomains(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async listDomains(request: ListDomainRequest): Promise<ListDomainResponse> {
    return this.client.domains.list(request)
  }
}

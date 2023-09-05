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
  CreateACLRequest,
  CreateACLResponse,
  GetACLResponse,
  ListACLRequest,
  ListACLResponse,
  UpdateACLRequest,
  UpdateACLResponse
} from "./types"

/**
 * @classdesc Use Routr ACL, a capability of Routr SIP Proxy, to create, update, get
 * and delete Access Control Lists. The ACL API requires of a running Routr deployment.
 *
 * @extends APIClient
 * @example
 *
 * const SDK = require("@routr/sdk")
 * const acl = new SDK.ACL()
 *
 * const request = {
 *   name: "Peer network",
 *   allow: "27.116.56.0/22",
 *   deny: "0.0.0.0/0"
 * }
 *
 * acl.createACL(request)
 *   .then(console.log)
 *   .catch(console.error)   // an error occurred
 */
export class ACL extends APIClient {
  /**
   * Constructs a new ACL API object.
   *
   * @param {ClientOptions} options - Options to indicate the objects endpoint
   * @see module:core:APIClient
   */
  constructor(options: ClientOptions) {
    super(options)
  }

  /**
   * Creates a new AccessControlList on Routr.
   *
   * @param {CreateACLRequest} request - The request to create an ACL
   * @param {string} request.name - Name of the ACL
   * @param {string[]} request.allow - List of IP addresses or CIDR blocks to allow
   * @param {string[]} request.deny - List of IP addresses or CIDR blocks to deny
   * @param {Object} request.extended - Optional extended attributes
   * @return {Promise<CreateACLResponse>} The newly created AccessControlList
   * @throws if request is null
   * @example
   *
   * const request = {
   *   name: "Peer network",
   *   allow: "27.116.56.0/22",
   *   deny: "0.0.0.0/0"
   * }
   *
   * acl.createACL(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async createACL(request: CreateACLRequest): Promise<CreateACLResponse> {
    return this.client.acl.create(request)
  }

  /**
   * Updates an already existing AccessControlList on Routr.
   *
   * @param {UpdateACLRequest} request - Partial with the fields to update
   * @param {string} request.name - Name of the ACL
   * @param {string[]} request.allow - List of IP addresses or CIDR blocks to allow
   * @param {string[]} request.deny - List of IP addresses or CIDR blocks to deny
   * @param {Object} request.extended - Optional extended attributes
   * @return {Promise<UpdateACLResponse>} The AccessControlList
   * @example
   *
   * const request = {
   *   ref: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
   *   name: "Peer network updated",
   * }
   *
   * acl.updateACL(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async updateACL(request: UpdateACLRequest): Promise<UpdateACLResponse> {
    return this.client.acl.update(request)
  }

  /**
   * Gets an AccessControlList from Routr.
   *
   * @param {string} ref - The ACL reference
   * @return {Promise<GetACLResponse>} The AccessControlList
   * @example
   *
   * const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
   *
   * acl.getACL(ref)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async getACL(ref: string): Promise<GetACLResponse> {
    return this.client.acl.get(ref)
  }

  /**
   * Deletes an AccessControlList from Routr.
   *
   * @param {string} ref - The ACL reference
   * @return {Promise<void>}
   * @example
   *
   * const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
   *
   * acl.deleteACL(ref)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async deleteACL(ref: string): Promise<void> {
    return this.client.acl.del(ref)
  }

  /**
   * Lists all AccessControlLists from Routr with pagination.
   *
   * @param {ListACLRequest} request - The request to list ACLs
   * @param {number} request.pageSize - The number of ACLs to return
   * @param {string} request.pageToken - The page token to use for pagination
   * @return {Promise<ListACLResponse>} The list of AccessControlLists
   * @example
   *
   * const request = {
   *  pageSize: 10
   * }
   *
   * acl.listACLs(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async listACLs(request: ListACLRequest): Promise<ListACLResponse> {
    return this.client.acl.list(request)
  }
}

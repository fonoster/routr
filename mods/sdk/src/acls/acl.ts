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
  CreateAclRequest,
  CreateAclResponse,
  GetAclResponse,
  ListAclRequest,
  ListAclResponse,
  UpdateAclRequest,
  UpdateAclResponse
} from "./types"

/**
 * @classdesc Use Routr ACL, a capability of Routr SIP Proxy, to create, update, get
 * and delete Access Control Lists. The ACL API requires of a running Routr deployment.
 *
 * @extends APIClient
 * @example
 *
 * const SDK = require("@routr/sdk")
 * const acl = new SDK.Acls()
 *
 * const request = {
 *   name: "Peer network",
 *   allow: "27.116.56.0/22",
 *   deny: "0.0.0.0/0"
 * }
 *
 * acl.createAcl(request)
 *   .then(console.log)
 *   .catch(console.error)   // an error occurred
 */
export class Acls extends APIClient {
  /**
   * Constructs a new API object.
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
   * @param {CreateAclRequest} request - The request to create an ACL
   * @param {string} request.name - Name of the ACL
   * @param {string[]} request.allow - List of IP addresses or CIDR blocks to allow
   * @param {string[]} request.deny - List of IP addresses or CIDR blocks to deny
   * @param {Object} request.extended - Optional extended attributes
   * @return {Promise<CreateAclResponse>} The newly created AccessControlList
   * @throws if request is null
   * @example
   *
   * const request = {
   *   name: "Peer network",
   *   allow: "27.116.56.0/22",
   *   deny: "0.0.0.0/0"
   * }
   *
   * acl.createAcl(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async createAcl(request: CreateAclRequest): Promise<CreateAclResponse> {
    return await this.client.acl.create(request)
  }

  /**
   * Updates an already existing AccessControlList on Routr.
   *
   * @param {UpdateAclRequest} request - Partial with the fields to update
   * @param {string} request.name - Name of the ACL
   * @param {string[]} request.allow - List of IP addresses or CIDR blocks to allow
   * @param {string[]} request.deny - List of IP addresses or CIDR blocks to deny
   * @param {Object} request.extended - Optional extended attributes
   * @return {Promise<UpdateAclResponse>} The AccessControlList
   * @example
   *
   * const request = {
   *   ref: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
   *   name: "Peer network updated",
   * }
   *
   * acl.updateAcl(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async updateAcl(request: UpdateAclRequest): Promise<UpdateAclResponse> {
    return this.client.acl.update(request)
  }

  /**
   * Gets an AccessControlList from Routr.
   *
   * @param {string} ref - The ACL reference
   * @return {Promise<GetAclResponse>} The AccessControlList
   * @example
   *
   * const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
   *
   * acl.getAcl(ref)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async getAcl(ref: string): Promise<GetAclResponse> {
    return await this.client.acl.get(ref)
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
   * acl.deleteAcl(ref)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async deleteAcl(ref: string): Promise<void> {
    return this.client.acl.del(ref)
  }

  /**
   * Lists all AccessControlLists from Routr with pagination.
   *
   * @param {ListAclRequest} request - The request to list ACLs
   * @param {number} request.pageSize - The number of ACLs to return
   * @param {string} request.pageToken - The page token to use for pagination
   * @return {Promise<ListAclResponse>} The list of AccessControlLists
   * @example
   *
   * const request = {
   *  pageSize: 10
   * }
   *
   * acl.listAcls(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async listAcls(request: ListAclRequest): Promise<ListAclResponse> {
    return this.client.acl.list(request)
  }
}

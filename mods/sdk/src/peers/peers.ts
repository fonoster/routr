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
  CreatePeerRequest,
  CreatePeerResponse,
  GetPeerResponse,
  ListPeerRequest,
  ListPeerResponse,
  UpdatePeerRequest,
  UpdatePeerResponse
} from "./types"

/**
 * @classdesc Use Routr Peers, a capability of Routr SIP Proxy, to create, update, get
 * and delete Peers. The Peers API requires of a running Routr deployment.
 *
 * @extends APIClient
 * @example
 *
 * const SDK = require("@routr/sdk")
 * const peers = new SDK.Peers()
 *
 * const request = {
 *   name: "Asterisk Conference Server",
 *   username: "conference",
 *   aor: "backend:conference",
 *   contactAddr: "10.0.0.1:5060",
 *   accessControlListRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
 *   credentialsRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
 *   balancingAlgorithm: LoadBalancingAlgorithm.LEAST_SESSIONS,
 *   withSessionAffinity: true,
 *   enabled: true,
 *   extended: {
 *     "key": "value"
 *   }
 * }
 *
 * peers.createPeer(request)
 *   .then(console.log)
 *   .catch(console.error)   // an error occurred
 */
export class Peers extends APIClient {
  /**
   * Constructs a new Peer API object.
   *
   * @param {ClientOptions} options - Options to indicate the objects endpoint
   * @see module:core:APIClient
   */
  constructor(options: ClientOptions) {
    super(options)
  }

  /**
   * Creates a new Peer on Routr.
   *
   * @param {CreatePeerRequest} request - The request to create an Peer
   * @param {string} request.name - Name of the Peer
   * @param {string} request.aor - Address of Record of the Peer
   * @param {string} request.contactAddr - Optional contact address of the Peer
   * @param {string} request.accessControlListRef - Access Control List reference of the Peer
   * @param {string} request.credentialsRef - Credentials reference of the Credentials for the Peer
   * @param {LoadBalancingAlgorithm} request.balancingAlgorithm - Optional balancing algorithm for the Peer (defaults to "round-robin")
   * @param {boolean} request.withSessionAffinity - Whether the Peer has session affinity or not (defaults to false)
   * @param {boolean} request.enabled - Whether the Peer is enabled or not (for future use)
   * @param {Object} request.extended - Optional extended attributes
   * @return {Promise<CreatePeerResponse>} The newly created Peer
   * @throws if request is null
   * @example
   *
   * const request = {
   *   name: "Asterisk Conference Server",
   *   username: "conference",
   *   aor: "backend:conference",
   *   contactAddr: "10.0.0.1:5060",
   *   accessControlListRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
   *   credentialsRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
   *   balancingAlgorithm: LoadBalancingAlgorithm.LEAST_SESSIONS,
   *   withSessionAffinity: true,
   *   enabled: true,
   *   extended: {
   *     "key": "value"
   *   }
   * }
   *
   * peers.createPeer(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async createPeer(request: CreatePeerRequest): Promise<CreatePeerResponse> {
    return this.client.peers.create(request)
  }

  /**
   * Updates an already existing Peer on Routr.
   *
   * @param {UpdatePeerRequest} request - Partial with the fields to update
   * @param {string} request.name - Name of the Peer
   * @param {string} request.aor - Address of Record of the Peer
   * @param {string} request.contactAddr - Optional contact address of the Peer
   * @param {string} request.accessControlListRef - Access Control List reference of the Peer
   * @param {string} request.credentialsRef - Credentials reference of the Credentials for the Peer
   * @param {LoadBalancingAlgorithm} request.balancingAlgorithm - Optional balancing algorithm for the Peer (defaults to "round-robin")
   * @param {boolean} request.withSessionAffinity - Whether the Peer has session affinity or not (defaults to false)
   * @param {boolean} request.enabled - Whether the Peer is enabled or not (for future use)
   * @param {Object} request.extended - Optional extended attributes
   * @return {Promise<UpdatePeerResponse>} The updated Peer
   * @example
   *
   * const request = {
   *   ref: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
   *   name: "Feature Server"
   * }
   *
   * peers.updatePeer(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async updatePeer(request: UpdatePeerRequest): Promise<UpdatePeerResponse> {
    return this.client.peers.update(request)
  }

  /**
   * Gets an Peer from Routr.
   *
   * @param {string} ref - The Peer's reference
   * @return {Promise<GetPeerResponse>} The Peer
   * @example
   *
   * const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
   *
   * peers.getPeer(ref)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async getPeer(ref: string): Promise<GetPeerResponse> {
    return this.client.peers.get(ref)
  }

  /**
   * Deletes an Peer from Routr.
   *
   * @param {string} ref - The Peer's reference
   * @return {Promise<void>}
   * @example
   *
   * const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
   *
   * peers.deletePeer(ref)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async deletePeer(ref: string): Promise<void> {
    return this.client.peers.del(ref)
  }

  /**
   * Lists all Peers from Routr with pagination.
   *
   * @param {ListPeerRequest} request - The request to list Peers
   * @param {number} request.pageSize - The number of Peers to return
   * @param {string} request.pageToken - The page token to use for pagination
   * @return {Promise<ListPeerResponse>} The list of Peers in the current page
   * @example
   *
   * const request = {
   *  pageSize: 10
   * }
   *
   * peers.listPeers(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async listPeers(request: ListPeerRequest): Promise<ListPeerResponse> {
    return this.client.peers.list(request)
  }
}

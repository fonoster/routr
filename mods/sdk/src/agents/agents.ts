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
  CreateAgentRequest,
  CreateAgentResponse,
  GetAgentResponse,
  ListAgentRequest,
  ListAgentResponse,
  UpdateAgentRequest,
  UpdateAgentResponse
} from "./types"

/**
 * @classdesc Use Routr Agents, a capability of Routr SIP Proxy, to create, update, get
 * and delete Agents. The Agents API requires of a running Routr deployment.
 *
 * @extends APIClient
 * @example
 *
 * const SDK = require("@routr/sdk")
 * const agents = new SDK.Agents()
 *
 * const request = {
 *   name: "Jonh Doe",
 *   username: "jdoe",
 *   privacy: Privacy.PRIVATE,
 *   domainRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
 *   credentialsRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
 *   enabled: true,
 *   extended: {
 *     "key": "value"
 *   }
 * }
 *
 * agents.createAgent(request)
 *   .then(console.log)
 *   .catch(console.error)   // an error occurred
 */
export class Agents extends APIClient {
  /**
   * Constructs a new Agent API object.
   *
   * @param {ClientOptions} options - Options to indicate the objects endpoint
   * @see module:core:APIClient
   */
  constructor(options: ClientOptions) {
    super(options)
  }

  /**
   * Creates a new Agent on Routr.
   *
   * @param {CreateAgentRequest} request - The request to create an Agent
   * @param {string} request.name - Name of the Agent
   * @param {string} request.username - Username of the Agent
   * @param {Privacy} request.privacy - Privacy of the Agent (e.g., Privacy.PRIVATE)
   * @param {string} request.domainRef - Domain reference of the Domain the Agent belongs to
   * @param {string} request.credentialsRef - Credentials reference of the Credentials for the Agent
   * @param {boolean} request.enabled - Whether the Agent is enabled or not (for future use)
   * @param {Object} request.extended - Optional extended attributes
   * @return {Promise<CreateAgentResponse>} The newly created Agent
   * @throws if request is null
   * @example
   *
   * const request = {
   *   name: "Jonh Doe",
   *   username: "jdoe",
   *   privacy: Privacy.PRIVATE,
   *   domainRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
   *   credentialsRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
   *   enabled: true,
   *   extended: {
   *     "key": "value"
   *   }
   * }
   *
   * agents.createAgent(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async createAgent(request: CreateAgentRequest): Promise<CreateAgentResponse> {
    return this.client.agents.create(request)
  }

  /**
   * Updates an already existing Agent on Routr.
   *
   * @param {UpdateAgentRequest} request - Partial with the fields to update
   * @param {string} request.name - Name of the Agent
   * @param {Privacy} request.privacy - Privacy of the Agent (e.g., Privacy.PRIVATE)
   * @param {string} request.domainRef - Domain reference of the Domain the Agent belongs to
   * @param {string} request.credentialsRef - Credentials reference of the Credentials for the Agent
   * @param {boolean} request.enabled - Whether the Agent is enabled or not (for future use)
   * @param {Object} request.extended - Optional extended attributes
   * @return {Promise<UpdateAgentResponse>} The updated Agent
   * @example
   *
   * const request = {
   *   ref: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
   *   name: "John D Doe",
   *   enabled: false
   * }
   *
   * agents.updateAgent(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async updateAgent(request: UpdateAgentRequest): Promise<UpdateAgentResponse> {
    return this.client.agents.update(request)
  }

  /**
   * Gets an Agent from Routr.
   *
   * @param {string} ref - The Agent's reference
   * @return {Promise<GetAgentResponse>} The Agent
   * @example
   *
   * const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
   *
   * agents.getAgent(ref)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async getAgent(ref: string): Promise<GetAgentResponse> {
    return this.client.agents.get(ref)
  }

  /**
   * Deletes an Agent from Routr.
   *
   * @param {string} ref - The Agent's reference
   * @return {Promise<void>}
   * @example
   *
   * const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
   *
   * agents.deleteAgent(ref)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async deleteAgent(ref: string): Promise<void> {
    return this.client.agents.del(ref)
  }

  /**
   * Lists all Agents from Routr with pagination.
   *
   * @param {ListAgentRequest} request - The request to list Agents
   * @param {number} request.pageSize - The number of Agents to return
   * @param {string} request.pageToken - The page token to use for pagination
   * @return {Promise<ListAgentResponse>} The list of Agents in the current page
   * @example
   *
   * const request = {
   *  pageSize: 10
   * }
   *
   * agents.listAgents(request)
   *   .then(console.log)
   *   .catch(console.error)   // an error occurred
   */
  async listAgents(request: ListAgentRequest): Promise<ListAgentResponse> {
    return this.client.agents.list(request)
  }
}

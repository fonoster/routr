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
/* eslint-disable require-jsdoc */
import * as Validator from "validator"
import {
  Agent as AgentPrismaModel,
  APIVersion,
  Prisma,
  Privacy
} from "@prisma/client"
import {
  CommonConnect as CC,
  CommonTypes as CT,
  CommonErrors as CE
} from "@routr/common"
import { JsonObject } from "pb-util/build"
import { CredentialsManager } from "./credentials"
import { DomainManager } from "./domain"
import { EntityManager } from "./manager"

type AgentWithDomainAndCredentials = Prisma.AgentGetPayload<{
  include: {
    domain: {
      include: {
        accessControlList: true
      }
    }
    credentials: true
  }
}>

// Needs testing
export class AgentManager extends EntityManager {
  constructor(private agent: CC.Agent) {
    super()
  }

  static includeFields(): JsonObject {
    return {
      domain: {
        include: {
          accessControlList: true
        }
      },
      credentials: true
    }
  }

  validOrThrowCreate() {
    if (!this.agent.name) {
      throw new CE.BadRequestError(
        "the friendly name for the resource is required"
      )
    }

    if (!Validator.default.isLength(this.agent.name, { min: 3, max: 64 })) {
      throw new CE.BadRequestError(
        "the friendly name must be between 3 and 64 characters"
      )
    }

    if (!this.agent.username) {
      throw new CE.BadRequestError("the username is required")
    }

    if (!Validator.default.isAlphanumeric(this.agent.username)) {
      throw new CE.BadRequestError(
        "the username must be alphanumeric and without spaces"
      )
    }
  }

  validOrThrowUpdate() {
    if (!this.agent.ref) {
      throw new CE.BadRequestError("the reference to the resource is required")
    }

    if (!this.agent.name) {
      throw new CE.BadRequestError(
        "the friendly name for the resource is required"
      )
    }

    if (!Validator.default.isLength(this.agent.name, { min: 3, max: 64 })) {
      throw new CE.BadRequestError(
        "the friendly name must be between 3 and 64 characters"
      )
    }
  }

  mapToPrisma(): AgentPrismaModel {
    return {
      // TODO: Set a default value for apiVersion
      apiVersion: "v2" as APIVersion,
      ref: this.agent.ref,
      name: this.agent.name,
      username: this.agent.username,
      privacy: (this.agent.privacy as Privacy) ?? Privacy.NONE,
      enabled: this.agent.enabled,
      domainRef: this.agent.domainRef || null,
      credentialsRef: this.agent.credentialsRef || null,
      createdAt: this.agent.createdAt,
      updatedAt: this.agent.updatedAt,
      extended: this.agent.extended || {}
    }
  }

  static mapToDto(agent: AgentWithDomainAndCredentials): CC.Agent {
    return {
      apiVersion: agent.apiVersion,
      ref: agent.ref,
      name: agent.name,
      username: agent.username,
      privacy: agent.privacy as CT.Privacy,
      enabled: agent.enabled,
      domainRef: agent.domainRef,
      domain: agent.domain ? DomainManager.mapToDto(agent.domain) : undefined,
      credentialsRef: agent.credentialsRef,
      credentials: agent.credentials
        ? CredentialsManager.mapToDto(agent.credentials)
        : undefined,
      extended: (agent.extended || {}) as JsonObject,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt
    }
  }
}

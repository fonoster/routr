/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
/* eslint-disable require-jsdoc */
import {
  Agent as AgentPrismaModel,
  APIVersion,
  Prisma,
  Privacy
} from "@prisma/client"
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"
import { JsonObject } from "pb-util/build"
import { CredentialsManager } from "./credentials"
import { DomainManager } from "./domain"
import { EntityManager } from "./manager"

type AgentWithDomainAndCredentials = Prisma.AgentGetPayload<{
  include: {
    domain: {
      include: {
        accessControlList: true
        egressPolicies: true
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
    CC.hasNameOrThrow(this.agent.name)
    CC.isValidNameOrThrow(this.agent.name)
    CC.hasUsernameOrThrow(this.agent.username)
    CC.isValidUsernameOrThrow(this.agent.username)
  }

  validOrThrowUpdate() {
    CC.hasRefenceOrThrow(this.agent.ref)
    CC.isValidNameOrThrow(this.agent.name)
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
      createdAt: this.agent.createdAt
        ? new Date(this.agent.createdAt * 1000)
        : undefined,
      updatedAt: this.agent.updatedAt
        ? new Date(this.agent.updatedAt * 1000)
        : undefined,
      extended: this.agent.extended || {}
    }
  }

  static mapToDto(agent: AgentWithDomainAndCredentials): CC.Agent {
    return agent
      ? {
          apiVersion: agent.apiVersion,
          ref: agent.ref,
          name: agent.name,
          username: agent.username,
          privacy: agent.privacy as CT.Privacy,
          enabled: agent.enabled,
          domainRef: agent.domainRef,
          credentialsRef: agent.credentialsRef,
          domain: DomainManager.mapToDto(agent.domain),
          credentials: CredentialsManager.mapToDto(agent.credentials),
          extended: (agent.extended || {}) as JsonObject,
          createdAt: agent.createdAt.getTime() / 1000,
          updatedAt: agent.updatedAt.getTime() / 1000
        }
      : undefined
  }
}

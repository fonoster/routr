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
/* eslint-disable require-jsdoc */
import {
  Agent as AgentPrismaModel,
  APIVersion,
  Prisma,
  Privacy
} from "@prisma/client"
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"
import { CredentialsManager } from "./credentials"
import { DomainManager } from "./domain"
import { EntityManager } from "./manager"
import { JsonValue } from "@prisma/client/runtime/library"

type AgentWithDomainAndCredentials = Prisma.AgentGetPayload<{
  include: {
    domain: {
      include: {
        accessControlList: true
        egressPolicies: {
          include: {
            number: true
          }
        }
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

  static includeFields(): Record<string, unknown> {
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
    CC.hasReferenceOrThrow(this.agent.ref)
    CC.isValidNameOrThrow(this.agent.name)
  }

  mapToPrisma(): AgentPrismaModel {
    return {
      // TODO: Set a default value for apiVersion
      ...this.agent,
      apiVersion: "v2" as APIVersion,
      privacy: (this.agent.privacy as Privacy) ?? Privacy.NONE,
      domainRef: this.agent.domainRef || null,
      credentialsRef: this.agent.credentialsRef || null,
      expires: this.agent.expires || 0,
      createdAt: undefined,
      updatedAt: undefined,
      extended: this.agent.extended as JsonValue
    }
  }

  static mapToDto(agent: AgentWithDomainAndCredentials): CC.Agent {
    return agent
      ? {
          ...agent,
          apiVersion: agent.apiVersion as CC.APIVersion,
          privacy: agent.privacy as CT.Privacy,
          domain: DomainManager.mapToDto(agent.domain),
          credentials: CredentialsManager.mapToDto(agent.credentials),
          createdAt: agent.createdAt.getTime() / 1000,
          updatedAt: agent.updatedAt.getTime() / 1000,
          extended: agent.extended as Record<string, unknown>
        }
      : undefined
  }
}

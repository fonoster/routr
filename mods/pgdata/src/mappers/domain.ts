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
  Domain as DomainPrismaModel,
  APIVersion,
  Prisma,
  EgressPolicy
} from "@prisma/client"
import { CommonConnect as CC } from "@routr/common"
import { JsonObject } from "pb-util/build"
import { ACLManager } from "./acl"
import { EntityManager } from "./manager"
import { NumberManager } from "./number"
import { JsonValue } from "@prisma/client/runtime/library"

type DomainWithACL = Prisma.DomainGetPayload<{
  include: {
    accessControlList: true
    egressPolicies: {
      include: {
        number: true
      }
    }
  }
}>

// Needs testing
export class DomainManager extends EntityManager {
  constructor(private domain: CC.Domain) {
    super()
  }

  static includeFields(): JsonObject {
    return {
      accessControlList: true,
      egressPolicies: {
        include: {
          number: true
        }
      }
    }
  }

  validOrThrowCreate() {
    CC.hasNameOrThrow(this.domain.name)
    CC.isValidNameOrThrow(this.domain.name)
    CC.isValidDomainUriOrThrow(this.domain.domainUri)
  }

  validOrThrowUpdate() {
    CC.hasReferenceOrThrow(this.domain.ref)
    CC.isValidNameOrThrow(this.domain.name)
  }

  mapToPrisma(): DomainPrismaModel & {
    egressPolicies: {
      create: Omit<EgressPolicy, "ref" | "domainRef">[]
    }
  } {
    return {
      // TODO: Set a default value for apiVersion
      ...this.domain,
      apiVersion: "v2" as APIVersion,
      accessControlListRef: this.domain.accessControlListRef || null,
      extended: this.domain.extended as JsonValue,
      egressPolicies: {
        create: this.domain.egressPolicies?.map((policy) => ({
          rule: policy.rule,
          numberRef: policy.numberRef
        }))
      }
    }
  }

  static mapToDto(domain: DomainWithACL): CC.Domain {
    return domain
      ? {
          ...domain,
          apiVersion: domain.apiVersion as CC.APIVersion,
          accessControlListRef: domain.accessControlList?.ref,
          accessControlList: ACLManager.mapToDto(domain.accessControlList),
          egressPolicies: domain.egressPolicies?.map((policy) => ({
            rule: policy.rule,
            numberRef: policy.numberRef,
            number: NumberManager.mapToDtoWithoutTrunk(policy.number)
          })),
          extended: domain.extended as JsonObject
        }
      : undefined
  }
}

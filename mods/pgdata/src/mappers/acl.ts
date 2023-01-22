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
import { AccessControlList as ACLPrismaModel, APIVersion } from "@prisma/client"
import { CommonConnect as CC } from "@routr/common"
import { JsonObject } from "pb-util/build"
import { EntityManager } from "./manager"

export class ACLManager extends EntityManager {
  constructor(private acl: CC.AccessControlList) {
    super()
  }

  static includeFields(): JsonObject {
    return null
  }

  validOrThrowCreate() {
    CC.hasNameOrThrow(this.acl.name)
    CC.isValidNameOrThrow(this.acl.name)
    CC.hasACLRulesOrThrow(this.acl)
    CC.hasValidACLRulesOrThrow(this.acl)
  }

  validOrThrowUpdate() {
    CC.hasRefenceOrThrow(this.acl.ref)
    CC.isValidNameOrThrow(this.acl.name)
    CC.hasValidACLRulesOrThrow(this.acl)
  }

  mapToPrisma(): ACLPrismaModel {
    return {
      // TODO: Create a default value for apiVersion
      apiVersion: "v2" as APIVersion,
      ref: this.acl.ref,
      name: this.acl.name,
      allow: this.acl.allow,
      deny: this.acl.deny,
      createdAt: this.acl.createdAt
        ? new Date(this.acl.createdAt * 1000)
        : undefined,
      updatedAt: this.acl.updatedAt
        ? new Date(this.acl.updatedAt * 1000)
        : undefined,
      extended: this.acl.extended || {}
    }
  }

  static mapToDto(acl: ACLPrismaModel): CC.AccessControlList {
    return acl
      ? {
          ...acl,
          createdAt: acl.createdAt.getTime() / 1000,
          updatedAt: acl.updatedAt.getTime() / 1000,
          extended: acl.extended as JsonObject
        }
      : undefined
  }
}

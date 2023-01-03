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
import { Domain as DomainPrismaModel, APIVersion, Prisma } from "@prisma/client"
import { CommonConnect as CC, CommonErrors as CE } from "@routr/common"
import { JsonObject } from "pb-util/build"
import { ACLManager } from "./acl"
import { EntityManager } from "./manager"

type DomainWithACL = Prisma.DomainGetPayload<{
  include: {
    accessControlList: true
  }
}>

// Needs testing
export class DomainManager extends EntityManager {
  constructor(private domain: CC.Domain) {
    super()
  }

  static includeFields(): JsonObject {
    return {
      accessControlList: true
    }
  }

  validOrThrowCreate() {
    if (!this.domain.name) {
      throw new CE.BadRequestError(
        "the friendly name for the resource is required"
      )
    }

    if (!Validator.default.isLength(this.domain.name, { min: 3, max: 64 })) {
      throw new CE.BadRequestError(
        "the friendly name must be between 3 and 64 characters"
      )
    }

    if (!this.domain.domainUri) {
      throw new CE.BadRequestError("the domainUri is required")
    }

    if (!Validator.default.isFQDN(this.domain.domainUri)) {
      throw new CE.BadRequestError(
        "the domainUri must be a valid fully qualified domain name"
      )
    }
  }

  validOrThrowUpdate() {
    if (!this.domain.ref) {
      throw new CE.BadRequestError("the reference to the resource is required")
    }

    if (!this.domain.name) {
      throw new CE.BadRequestError(
        "the friendly name for the resource is required"
      )
    }

    if (!Validator.default.isLength(this.domain.name, { min: 3, max: 64 })) {
      throw new CE.BadRequestError(
        "the friendly name must be between 3 and 64 characters"
      )
    }
  }

  mapToPrisma(): DomainPrismaModel {
    return {
      // TODO: Set a default value for apiVersion
      apiVersion: "v2" as APIVersion,
      ref: this.domain.ref,
      name: this.domain.name,
      accessControlListRef: this.domain.accessControlListRef,
      domainUri: this.domain.domainUri,
      extended: this.domain.extended as JsonObject,
      createdAt: this.domain.createdAt,
      updatedAt: this.domain.updatedAt
    }
  }

  static mapToDto(domain: DomainWithACL): CC.Domain {
    return {
      apiVersion: domain.apiVersion,
      ref: domain.ref,
      name: domain.name,
      accessControlListRef: domain.accessControlList?.ref,
      accessControlList: ACLManager.mapToDto(domain.accessControlList),
      domainUri: domain.domainUri,
      extended: domain.extended as JsonObject,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt
    }
  }
}

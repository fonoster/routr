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
import { AccessControlList as ACLPrismaModel, APIVersion } from "@prisma/client"
import { CommonConnect as CC, CommonErrors as CE } from "@routr/common"
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
    if (!this.acl.name) {
      throw new CE.BadRequestError(
        "the friendly name for the resource is required"
      )
    }

    if (!Validator.default.isLength(this.acl.name, { min: 3, max: 64 })) {
      throw new CE.BadRequestError(
        "the friendly name must be between 3 and 64 characters"
      )
    }

    if (
      !this.acl.deny ||
      !this.acl.allow ||
      this.acl.deny?.length === 0 ||
      this.acl.allow?.length === 0
    ) {
      throw new CE.BadRequestError("acl rules are required")
    }

    this.acl.deny.forEach((cidr) => {
      // 4 => IPv4
      if (!Validator.default.isIPRange(cidr, 4)) {
        throw new CE.BadRequestError(`${cidr} is not a valid cidr`)
      }
    })

    this.acl.allow.forEach((cidr) => {
      // 4 => IPv4
      if (!Validator.default.isIPRange(cidr, 4)) {
        throw new CE.BadRequestError(`${cidr} is not a valid cidr`)
      }
    })
  }

  validOrThrowUpdate() {
    if (!this.acl.ref) {
      throw new CE.BadRequestError("the reference to the resource is required")
    }

    if (!this.acl.name) {
      throw new CE.BadRequestError(
        "the friendly name for the resource is required"
      )
    }

    if (!Validator.default.isLength(this.acl.name, { min: 4, max: 64 })) {
      throw new CE.BadRequestError(
        "the friendly name must be between 3 and 64 characters"
      )
    }

    if (
      !this.acl.deny ||
      !this.acl.allow ||
      this.acl.deny?.length === 0 ||
      this.acl.allow?.length === 0
    ) {
      throw new CE.BadRequestError("acl rules are required")
    }

    this.acl.deny.forEach((cidr) => {
      // 4 => IPv4
      if (!Validator.default.isIPRange(cidr, 4)) {
        throw new CE.BadRequestError(`${cidr} is not a valid cidr`)
      }
    })

    this.acl.allow.forEach((cidr) => {
      // 4 => IPv4
      if (!Validator.default.isIPRange(cidr, 4)) {
        throw new CE.BadRequestError(`${cidr} is not a valid cidr`)
      }
    })
  }

  mapToPrisma(): ACLPrismaModel {
    return {
      // TODO: Set a default value for apiVersion
      apiVersion: "v2" as APIVersion,
      ref: this.acl.ref,
      name: this.acl.name,
      allow: this.acl.allow,
      deny: this.acl.deny,
      extended: this.acl.extended || {}
    }
  }

  static mapToDto(acl: ACLPrismaModel): CC.AccessControlList {
    return {
      ...acl,
      extended: acl.extended as JsonObject
    }
  }
}

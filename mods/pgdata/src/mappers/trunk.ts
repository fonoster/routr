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
import { Trunk as TrunkPrismaModel, APIVersion, Prisma } from "@prisma/client"
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"
import { CommonErrors as CE } from "@routr/common"
import { JsonObject } from "pb-util/build"
import { ACLManager } from "./acl"
import { CredentialsManager } from "./credentials"
import { EntityManager } from "./manager"

type TrunkWithEagerLoading = Prisma.TrunkGetPayload<{
  include: {
    accessControlList: true
    inboundCredentials: true
    outboundCredentials: true
    uris: true
  }
}>

// Needs testing
export class TrunkManager extends EntityManager {
  constructor(private trunk: CC.Trunk | Omit<CC.Trunk, "uris">) {
    super()
  }

  static includeFields(): JsonObject {
    return {
      accessControlList: true,
      inboundCredentials: true,
      outboundCredentials: true,
      uris: true
    }
  }

  validOrThrowCreate() {
    if (!this.trunk.name) {
      throw new CE.BadRequestError(
        "the friendly name for the resource is required"
      )
    }

    if (!Validator.default.isLength(this.trunk.name, { min: 3, max: 64 })) {
      throw new CE.BadRequestError(
        "the friendly name must be between 3 and 64 characters"
      )
    }

    if (!this.trunk.inboundUri) {
      throw new CE.BadRequestError("the inboundUri is required")
    }

    if (!Validator.default.isFQDN(this.trunk.inboundUri)) {
      throw new CE.BadRequestError(
        "the inbound URI must be a valid FQDN (e.g. sip.example.com)"
      )
    }
  }

  validOrThrowUpdate() {
    if (!this.trunk.ref) {
      throw new CE.BadRequestError("the reference to the resource is required")
    }

    if (!this.trunk.name) {
      throw new CE.BadRequestError(
        "the friendly name for the resource is required"
      )
    }

    if (!Validator.default.isLength(this.trunk.name, { min: 3, max: 64 })) {
      throw new CE.BadRequestError(
        "the friendly name must be between 3 and 64 characters"
      )
    }

    if (this.trunk.inboundUri) {
      if (!Validator.default.isFQDN(this.trunk.inboundUri)) {
        throw new CE.BadRequestError(
          "the inbound URI must be a valid FQDN (e.g. sip.example.com)"
        )
      }
    }
  }

  mapToPrisma(): TrunkPrismaModel {
    return {
      // TODO: Set a default value for apiVersion
      apiVersion: "v2" as APIVersion,
      ref: this.trunk.ref,
      name: this.trunk.name,
      accessControlListRef: this.trunk.accessControlListRef,
      inboundUri: this.trunk.inboundUri,
      inboundCredentialsRef: this.trunk.inboundCredentialsRef,
      outboundCredentialsRef: this.trunk.outboundCredentialsRef,
      extended: this.trunk.extended,
      sendRegister: this.trunk.sendRegister,
      createdAt: this.trunk.createdAt,
      updatedAt: this.trunk.updatedAt
    }
  }

  static mapToDto(trunk: TrunkWithEagerLoading): CC.Trunk {
    return {
      apiVersion: trunk.apiVersion,
      ref: trunk.ref,
      name: trunk.name,
      accessControlListRef: trunk.accessControlList?.ref,
      accessControlList: ACLManager.mapToDto(trunk.accessControlList),
      inboundUri: trunk.inboundUri,
      inboundCredentialsRef: trunk.inboundCredentials?.ref,
      inboundCredentials: CredentialsManager.mapToDto(trunk.inboundCredentials),
      outboundCredentialsRef: trunk.outboundCredentials?.ref,
      outboundCredentials: CredentialsManager.mapToDto(
        trunk.outboundCredentials
      ),
      extended: trunk.extended as JsonObject,
      sendRegister: trunk.sendRegister,
      uris: trunk.uris.map((uri) => {
        return {
          ref: uri.ref,
          trunkRef: uri.trunkRef,
          host: uri.host,
          port: uri.port,
          transport: uri.transport.toUpperCase() as CT.Transport,
          user: uri.user,
          weight: uri.weight,
          priority: uri.priority,
          enabled: uri.enabled
        }
      }),
      createdAt: trunk.createdAt,
      updatedAt: trunk.updatedAt
    }
  }
}

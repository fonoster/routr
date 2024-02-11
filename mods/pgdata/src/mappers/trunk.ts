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
  Trunk as TrunkPrismaModel,
  APIVersion,
  Prisma,
  TrunkURI
} from "@prisma/client"
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"
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
  constructor(private trunk: CC.Trunk) {
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
    CC.hasNameOrThrow(this.trunk.name)
    CC.isValidNameOrThrow(this.trunk.name)
    CC.hasInboundUriOrThrow(this.trunk.inboundUri)
    CC.isValidInboundUriOrThrow(this.trunk.inboundUri)
    CC.hasValidOutboundUrisOrThrow(this.trunk.uris)
  }

  validOrThrowUpdate() {
    CC.hasRefenceOrThrow(this.trunk.ref)
    CC.isValidNameOrThrow(this.trunk.name)
    CC.isValidInboundUriOrThrow(this.trunk.inboundUri)
  }

  mapToPrisma(): TrunkPrismaModel & {
    uris: { create: Omit<TrunkURI, "ref" | "trunkRef">[] }
  } {
    return {
      // TODO: Set a default value for apiVersion
      apiVersion: "v2" as APIVersion,
      ref: this.trunk.ref,
      name: this.trunk.name,
      accessControlListRef: this.trunk.accessControlListRef || null,
      inboundUri: this.trunk.inboundUri,
      inboundCredentialsRef: this.trunk.inboundCredentialsRef || null,
      outboundCredentialsRef: this.trunk.outboundCredentialsRef || null,
      sendRegister: this.trunk.sendRegister,
      createdAt: this.trunk.createdAt
        ? new Date(this.trunk.createdAt * 1000)
        : undefined,
      updatedAt: this.trunk.updatedAt
        ? new Date(this.trunk.updatedAt * 1000)
        : undefined,
      extended: this.trunk.extended || {},
      uris: {
        create: this.trunk.uris?.map((uri) => {
          return {
            host: uri.host,
            port: uri.port,
            transport: uri.transport,
            user: uri.user,
            weight: uri.weight,
            priority: uri.priority,
            enabled: uri.enabled
          }
        })
      }
    }
  }

  static mapToDto(trunk: TrunkWithEagerLoading): CC.Trunk {
    return trunk
      ? {
          apiVersion: trunk.apiVersion,
          ref: trunk.ref,
          name: trunk.name,
          inboundUri: trunk.inboundUri,
          accessControlListRef: trunk.accessControlList?.ref,
          inboundCredentialsRef: trunk.inboundCredentials?.ref,
          outboundCredentialsRef: trunk.outboundCredentials?.ref,
          inboundCredentials: CredentialsManager.mapToDto(
            trunk.inboundCredentials
          ),
          accessControlList: ACLManager.mapToDto(trunk.accessControlList),
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
          createdAt: trunk.createdAt.getTime() / 1000,
          updatedAt: trunk.updatedAt.getTime() / 1000
        }
      : undefined
  }
}

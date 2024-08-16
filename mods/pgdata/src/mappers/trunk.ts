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
import { ACLManager } from "./acl"
import { CredentialsManager } from "./credentials"
import { EntityManager } from "./manager"
import { JsonValue } from "@prisma/client/runtime/library"

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

  static includeFields(): Record<string, unknown> {
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
    CC.hasReferenceOrThrow(this.trunk.ref)
    CC.isValidNameOrThrow(this.trunk.name)
    CC.isValidInboundUriOrThrow(this.trunk.inboundUri)
  }

  mapToPrisma(): TrunkPrismaModel & {
    uris: { create: Omit<TrunkURI, "ref" | "trunkRef">[] }
  } {
    return {
      // TODO: Set a default value for apiVersion
      ...this.trunk,
      apiVersion: "v2" as APIVersion,
      accessControlListRef: this.trunk.accessControlListRef || null,
      inboundCredentialsRef: this.trunk.inboundCredentialsRef || null,
      outboundCredentialsRef: this.trunk.outboundCredentialsRef || null,
      uris: {
        create: this.trunk.uris
      },
      extended: this.trunk.extended as JsonValue,
      createdAt: undefined,
      updatedAt: undefined
    }
  }

  static mapToDto(trunk: TrunkWithEagerLoading): CC.Trunk {
    return trunk
      ? {
          ...trunk,
          apiVersion: trunk.apiVersion as CC.APIVersion,
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
          uris: trunk.uris.map((uri) => {
            return {
              ...uri,
              transport: uri.transport.toUpperCase() as CT.Transport
            }
          }),
          createdAt: trunk.createdAt.getTime() / 1000,
          updatedAt: trunk.updatedAt.getTime() / 1000,
          extended: trunk.extended as Record<string, unknown>
        }
      : undefined
  }
}

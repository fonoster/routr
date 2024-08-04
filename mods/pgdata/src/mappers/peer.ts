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
import { Peer as PeerPrismaModel, APIVersion, Prisma } from "@prisma/client"
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"
import { ACLManager } from "./acl"
import { CredentialsManager } from "./credentials"
import { EntityManager } from "./manager"
import { JsonValue } from "@prisma/client/runtime/library"

type PeerWithDomainAndCredentials = Prisma.PeerGetPayload<{
  include: {
    accessControlList: true
    credentials: true
  }
}>

// Needs testing
export class PeerManager extends EntityManager {
  constructor(private peer: CC.Peer) {
    super()
  }

  static includeFields(): Record<string, unknown> {
    return {
      accessControlList: true,
      credentials: true
    }
  }

  validOrThrowCreate() {
    CC.hasNameOrThrow(this.peer.name)
    CC.isValidNameOrThrow(this.peer.name)
    CC.hasUsernameOrThrow(this.peer.username)
    CC.isValidUsernameOrThrow(this.peer.username)
    CC.hasAOROrThrow(this.peer.aor)
    CC.isValidAOROrThrow(this.peer.aor)
    CC.isValidContactAddressOrThrow(this.peer.contactAddr)
  }

  validOrThrowUpdate() {
    CC.hasReferenceOrThrow(this.peer.ref)
    CC.isValidNameOrThrow(this.peer.name)
    CC.isValidUsernameOrThrow(this.peer.username)
    CC.isValidAOROrThrow(this.peer.aor)
    CC.isValidContactAddressOrThrow(this.peer.contactAddr)
  }

  mapToPrisma(): PeerPrismaModel {
    const normalizeAlgorithm = (algorithm: CT.LoadBalancingAlgorithm) =>
      algorithm === CT.LoadBalancingAlgorithm.UNSPECIFIED
        ? undefined
        : algorithm

    return {
      // TODO: Set a default value for apiVersion
      ...this.peer,
      apiVersion: "v2" as APIVersion,
      balancingAlgorithm: normalizeAlgorithm(this.peer.balancingAlgorithm),
      withSessionAffinity: this.peer.withSessionAffinity,
      credentialsRef: this.peer.credentialsRef || null,
      accessControlListRef: this.peer.accessControlListRef || null,
      expires: this.peer.expires || 0,
      createdAt: undefined,
      updatedAt: undefined,
      extended: this.peer.extended as JsonValue
    }
  }

  static mapToDto(peer: PeerWithDomainAndCredentials): CC.Peer {
    return peer
      ? {
          ...peer,
          apiVersion: peer.apiVersion as CC.APIVersion,
          balancingAlgorithm:
            peer.balancingAlgorithm as CT.LoadBalancingAlgorithm,
          credentials: CredentialsManager.mapToDto(peer.credentials),
          accessControlList: ACLManager.mapToDto(peer.accessControlList),
          createdAt: peer.createdAt.getTime() / 1000,
          updatedAt: peer.updatedAt.getTime() / 1000,
          extended: peer.extended as Record<string, unknown>
        }
      : undefined
  }
}

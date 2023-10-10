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
import { Peer as PeerPrismaModel, APIVersion, Prisma } from "@prisma/client"
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"
import { JsonObject } from "pb-util/build"
import { ACLManager } from "./acl"
import { CredentialsManager } from "./credentials"
import { EntityManager } from "./manager"

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

  static includeFields(): JsonObject {
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
    CC.isValidBalancingAlgorithmOrThrow(
      this.peer.aor,
      this.peer.balancingAlgorithm
    )
  }

  validOrThrowUpdate() {
    CC.hasRefenceOrThrow(this.peer.ref)
    CC.isValidNameOrThrow(this.peer.name)
    CC.isValidUsernameOrThrow(this.peer.username)
    CC.isValidAOROrThrow(this.peer.aor)
    CC.isValidContactAddressOrThrow(this.peer.contactAddr)
    CC.isValidBalancingAlgorithmOrThrow(
      this.peer.aor,
      this.peer.balancingAlgorithm
    )
  }

  mapToPrisma(): PeerPrismaModel {
    const normalizeAlgorithm = (algorithm: CT.LoadBalancingAlgorithm) =>
      algorithm === CT.LoadBalancingAlgorithm.UNSPECIFIED
        ? undefined
        : algorithm

    return {
      // TODO: Set a default value for apiVersion
      apiVersion: "v2" as APIVersion,
      ref: this.peer.ref,
      name: this.peer.name,
      username: this.peer.username,
      aor: this.peer.aor,
      contactAddr: this.peer.contactAddr,
      balancingAlgorithm: normalizeAlgorithm(this.peer.balancingAlgorithm),
      withSessionAffinity: this.peer.withSessionAffinity,
      enabled: this.peer.enabled,
      credentialsRef: this.peer.credentialsRef || null,
      accessControlListRef: this.peer.accessControlListRef || null,
      createdAt: this.peer.createdAt
        ? new Date(this.peer.createdAt * 1000)
        : undefined,
      updatedAt: this.peer.updatedAt
        ? new Date(this.peer.updatedAt * 1000)
        : undefined,
      extended: this.peer.extended || {}
    }
  }

  static mapToDto(peer: PeerWithDomainAndCredentials): CC.Peer {
    return peer
      ? {
          apiVersion: peer.apiVersion,
          ref: peer.ref,
          name: peer.name,
          username: peer.username,
          aor: peer.aor,
          contactAddr: peer.contactAddr,
          balancingAlgorithm:
            peer.balancingAlgorithm as CT.LoadBalancingAlgorithm,
          withSessionAffinity: peer.withSessionAffinity,
          enabled: peer.enabled,
          credentialsRef: peer.credentialsRef,
          credentials: CredentialsManager.mapToDto(peer.credentials),
          accessControlListRef: peer.accessControlListRef,
          accessControlList: ACLManager.mapToDto(peer.accessControlList),
          createdAt: peer.createdAt.getTime() / 1000,
          updatedAt: peer.updatedAt.getTime() / 1000,
          extended: peer.extended as JsonObject
        }
      : undefined
  }
}

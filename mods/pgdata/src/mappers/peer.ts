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
import {
  Peer as PeerPrismaModel,
  APIVersion,
  Prisma,
  LoadBalancingAlgorithm
} from "@prisma/client"
import {
  CommonConnect as CC,
  CommonErrors as CE,
  CommonTypes as CT
} from "@routr/common"
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
    if (!this.peer.name) {
      throw new CE.BadRequestError(
        "the friendly name for the resource is required"
      )
    }

    if (!Validator.default.isLength(this.peer.name, { min: 3, max: 64 })) {
      throw new CE.BadRequestError(
        "the friendly name must be between 3 and 64 characters"
      )
    }

    if (!this.peer.username) {
      throw new CE.BadRequestError("the username is required")
    }

    if (!Validator.default.isAlphanumeric(this.peer.username)) {
      throw new CE.BadRequestError(
        "the username must be alphanumeric and without spaces"
      )
    }

    if (!this.peer.aor) {
      throw new CE.BadRequestError("the address of record (aor) is required")
    }

    // TODO: We will need a better way to validate this so is a valid SIP URI
    if (
      !this.peer.aor.startsWith("backend:") &&
      !this.peer.aor.startsWith("sip:")
    ) {
      throw new CE.BadRequestError(
        "the aor schema must start with `backend:` or `sip:`"
      )
    }

    if (this.peer.aor.startsWith("backend:")) {
      if (!this.peer.balancingAlgorithm) {
        throw new CE.BadRequestError(
          "when the aor schema is `backend:`, the balancing algorithm is required"
        )
      }
    }

    if (this.peer.aor.startsWith("sip:")) {
      if (this.peer.balancingAlgorithm) {
        throw new CE.BadRequestError(
          "when the aor schema is `sip:`, the balancing algorithm is not allowed"
        )
      }
    }
  }

  validOrThrowUpdate() {
    if (!this.peer.ref) {
      throw new CE.BadRequestError("the reference to the resource is required")
    }

    if (!this.peer.name) {
      throw new CE.BadRequestError(
        "the friendly name for the resource is required"
      )
    }

    if (!Validator.default.isLength(this.peer.name, { min: 3, max: 64 })) {
      throw new CE.BadRequestError(
        "the friendly name must be between 3 and 64 characters"
      )
    }

    if (this.peer.aor) {
      // TODO: We will need a better way to validate this so is a valid SIP URI
      if (
        !this.peer.aor.startsWith("backend:") &&
        !this.peer.aor.startsWith("sip:")
      ) {
        throw new CE.BadRequestError(
          "the aor schema must start with `backend:` or `sip:`"
        )
      }
    }

    if (this.peer.aor.startsWith("backend:")) {
      if (!this.peer.balancingAlgorithm) {
        throw new CE.BadRequestError(
          "when the aor schema is `backend:`, the balancing algorithm is required"
        )
      }
    }

    if (this.peer.aor.startsWith("sip:")) {
      if (this.peer.balancingAlgorithm) {
        throw new CE.BadRequestError(
          "when the aor schema is `sip:`, the balancing algorithm is not allowed"
        )
      }
    }
  }

  mapToPrisma(): PeerPrismaModel {
    return {
      // TODO: Set a default value for apiVersion
      apiVersion: "v2" as APIVersion,
      ref: this.peer.ref,
      name: this.peer.name,
      username: this.peer.username,
      aor: this.peer.aor,
      contactAddr: this.peer.contactAddr,
      balancingAlgorithm: this.peer
        .balancingAlgorithm as unknown as LoadBalancingAlgorithm,
      withSessionAffinity: this.peer.withSessionAffinity,
      enabled: this.peer.enabled,
      credentialsRef: this.peer.credentialsRef,
      accessControlListRef: this.peer.accessControlListRef,
      createdAt: this.peer.createdAt,
      updatedAt: this.peer.updatedAt,
      extended: this.peer.extended
    }
  }

  static mapToDto(peer: PeerWithDomainAndCredentials): CC.Peer {
    return {
      apiVersion: peer.apiVersion,
      ref: peer.ref,
      name: peer.name,
      username: peer.username,
      aor: peer.aor,
      contactAddr: peer.contactAddr,
      balancingAlgorithm: peer.balancingAlgorithm as CT.LoadBalancingAlgorithm,
      withSessionAffinity: peer.withSessionAffinity,
      enabled: peer.enabled,
      credentialsRef: peer.credentialsRef,
      credentials: CredentialsManager.mapToDto(peer.credentials),
      accessControlListRef: peer.accessControlListRef,
      accessControlList: ACLManager.mapToDto(peer.accessControlList),
      createdAt: peer.createdAt,
      updatedAt: peer.updatedAt,
      extended: peer.extended as JsonObject
    }
  }
}

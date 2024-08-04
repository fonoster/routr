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
  Credentials as CredentialsPrismaModel,
  APIVersion
} from "@prisma/client"
import { CommonConnect as CC } from "@routr/common"
import { EntityManager } from "./manager"
import { JsonValue } from "@prisma/client/runtime/library"

// Needs testing
export class CredentialsManager extends EntityManager {
  constructor(private credentials: CC.Credentials) {
    super()
  }

  static includeFields(): Record<string, unknown> {
    return null
  }

  validOrThrowCreate() {
    CC.hasNameOrThrow(this.credentials.name)
    CC.isValidNameOrThrow(this.credentials.name)
    CC.hasUsernameOrThrow(this.credentials.username)
    CC.isValidUsernameOrThrow(this.credentials.username)
    CC.hasPasswordOrThrow(this.credentials.password)
  }

  validOrThrowUpdate() {
    CC.hasReferenceOrThrow(this.credentials.ref)
    CC.isValidNameOrThrow(this.credentials.name)
    CC.isValidUsernameOrThrow(this.credentials.username)
  }

  mapToPrisma(): CredentialsPrismaModel {
    return {
      // TODO: Set a default value for apiVersion
      ...this.credentials,
      apiVersion: "v2" as APIVersion,
      createdAt: undefined,
      updatedAt: undefined,
      extended: this.credentials.extended as JsonValue
    }
  }

  static mapToDto(credentials: CredentialsPrismaModel): CC.Credentials {
    return credentials
      ? {
          ...credentials,
          apiVersion: credentials.apiVersion as CC.APIVersion,
          createdAt: credentials.createdAt.getTime() / 1000,
          updatedAt: credentials.updatedAt.getTime() / 1000,
          extended: credentials.extended as Record<string, unknown>
        }
      : undefined
  }
}

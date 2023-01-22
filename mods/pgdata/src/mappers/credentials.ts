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
import {
  Credentials as CredentialsPrismaModel,
  APIVersion
} from "@prisma/client"
import { CommonConnect as CC } from "@routr/common"
import { JsonObject } from "pb-util/build"
import { EntityManager } from "./manager"

// Needs testing
export class CredentialsManager extends EntityManager {
  constructor(private credentials: CC.Credentials) {
    super()
  }

  static includeFields(): JsonObject {
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
    CC.hasRefenceOrThrow(this.credentials.ref)
    CC.isValidNameOrThrow(this.credentials.name)
    CC.isValidUsernameOrThrow(this.credentials.username)
  }

  mapToPrisma(): CredentialsPrismaModel {
    return {
      // TODO: Set a default value for apiVersion
      apiVersion: "v2" as APIVersion,
      ref: this.credentials.ref,
      name: this.credentials.name,
      username: this.credentials.username,
      password: this.credentials.password || undefined,
      createdAt: this.credentials.createdAt
        ? new Date(this.credentials.createdAt * 1000)
        : undefined,
      updatedAt: this.credentials.updatedAt
        ? new Date(this.credentials.updatedAt * 1000)
        : undefined,
      extended: this.credentials.extended || {}
    }
  }

  static mapToDto(credentials: CredentialsPrismaModel): CC.Credentials {
    return credentials
      ? {
          apiVersion: credentials.apiVersion,
          ref: credentials.ref,
          name: credentials.name,
          username: credentials.username,
          password: credentials.password,
          createdAt: credentials.createdAt.getTime() / 1000,
          updatedAt: credentials.updatedAt.getTime() / 1000,
          extended: credentials.extended as JsonObject
        }
      : undefined
  }
}

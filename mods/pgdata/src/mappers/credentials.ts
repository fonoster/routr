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
  Credentials as CredentialsPrismaModel,
  APIVersion
} from "@prisma/client"
import { CommonConnect as CC, CommonErrors as CE } from "@routr/common"
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
    if (!this.credentials.name) {
      throw new CE.BadRequestError(
        "the friendly name for the resource is required"
      )
    }

    if (
      !Validator.default.isLength(this.credentials.name, { min: 3, max: 64 })
    ) {
      throw new CE.BadRequestError(
        "the friendly name must be between 3 and 64 characters"
      )
    }

    if (!this.credentials.username) {
      throw new CE.BadRequestError("the username is required")
    }

    if (!this.credentials.password) {
      throw new CE.BadRequestError("the password is required")
    }

    if (!Validator.default.isAlphanumeric(this.credentials.username)) {
      throw new CE.BadRequestError(
        "the username must be alphanumeric and without spaces"
      )
    }
  }

  validOrThrowUpdate() {
    if (!this.credentials.ref) {
      throw new CE.BadRequestError("the reference to the resource is required")
    }

    if (!this.credentials.name) {
      throw new CE.BadRequestError(
        "the friendly name for the resource is required"
      )
    }

    if (
      !Validator.default.isLength(this.credentials.name, { min: 3, max: 64 })
    ) {
      throw new CE.BadRequestError(
        "the friendly name must be between 3 and 64 characters"
      )
    }

    if (this.credentials.username) {
      if (!Validator.default.isAlphanumeric(this.credentials.username)) {
        throw new CE.BadRequestError(
          "the username must be alphanumeric and without spaces"
        )
      }
    }
  }

  mapToPrisma(): CredentialsPrismaModel {
    return {
      // TODO: Set a default value for apiVersion
      apiVersion: "v2" as APIVersion,
      ref: this.credentials.ref,
      name: this.credentials.name,
      username: this.credentials.username,
      password: this.credentials.password,
      extended: this.credentials.extended as JsonObject
    }
  }

  static mapToDto(credentials: CredentialsPrismaModel): CC.Credentials {
    return {
      apiVersion: credentials.apiVersion,
      ref: credentials.ref,
      name: credentials.name,
      username: credentials.username,
      password: credentials.password,
      extended: credentials.extended as JsonObject
    }
  }
}

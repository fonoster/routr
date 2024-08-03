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
import { Number as NumberPrismaModel, APIVersion, Prisma } from "@prisma/client"
import { CommonConnect as CC, Environment } from "@routr/common"
import { JsonObject } from "pb-util/build"
import { EntityManager } from "./manager"
import { TrunkManager } from "./trunk"
import { JsonValue } from "@prisma/client/runtime/library"

type NumberWithTrunk = Prisma.NumberGetPayload<{
  include: {
    trunk: {
      include: {
        accessControlList: true
        inboundCredentials: true
        outboundCredentials: true
        uris: true
      }
    }
  }
}>

// Needs testing
export class NumberManager extends EntityManager {
  constructor(private number: CC.INumber) {
    super()
  }

  static includeFields(): JsonObject {
    return {
      trunk: {
        include: {
          accessControlList: true,
          inboundCredentials: true,
          outboundCredentials: true,
          uris: true
        }
      }
    }
  }

  validOrThrowCreate() {
    CC.hasTelUrlOrThrow(this.number.telUrl)
    CC.isValidTelUrlOrThrow(this.number.telUrl)
    if (Environment.ENFORCE_E164) {
      CC.isValidE164OrThrow(
        this.number.telUrl.split("tel:")[1],
        this.number.countryIsoCode,
        Environment.ENFORCE_E164_WITH_MOBILE_PREFIX
      )
    }
    CC.hasNameOrThrow(this.number.name)
    CC.isValidNameOrThrow(this.number.name)
    CC.isValidAORLinkOrThrow(this.number.aorLink)
    CC.hasCityOrThrow(this.number.city)
    CC.hasCountryOrThrow(this.number.country)
    CC.hasCountryIsoCodeOrThrow(this.number.countryIsoCode)
    CC.hasValidHeadersOrThrow(this.number.extraHeaders)
    CC.isValidSessionAffinityHeaderOrThrow(this.number.sessionAffinityHeader)
  }

  validOrThrowUpdate() {
    CC.hasReferenceOrThrow(this.number.ref)
    CC.isValidNameOrThrow(this.number.name)
    CC.isValidAORLinkOrThrow(this.number.aorLink)
    CC.hasValidHeadersOrThrow(this.number.extraHeaders)
    CC.isValidSessionAffinityHeaderOrThrow(this.number.sessionAffinityHeader)
  }

  mapToPrisma(): NumberPrismaModel {
    return {
      // TODO: Set a default value for apiVersion
      ...this.number,
      apiVersion: "v2" as APIVersion,
      trunkRef: this.number.trunkRef,
      sessionAffinityHeader: this.number.sessionAffinityHeader,
      extraHeaders: this.number.extraHeaders,
      extended: this.number.extended as JsonValue
    }
  }

  static mapToDto(number: NumberWithTrunk): CC.INumber {
    return number
      ? {
          ...number,
          apiVersion: number.apiVersion as CC.APIVersion,
          trunk: TrunkManager.mapToDto(number.trunk),
          extraHeaders: number.extraHeaders as {
            name: string
            value: string
          }[],
          extended: number.extended as JsonObject
        }
      : undefined
  }

  static mapToDtoWithoutTrunk(number: NumberPrismaModel): CC.INumber {
    return number
      ? {
          ...number,
          apiVersion: number.apiVersion as CC.APIVersion,
          extraHeaders: number.extraHeaders as {
            name: string
            value: string
          }[],
          extended: number.extended as JsonObject
        }
      : undefined
  }
}

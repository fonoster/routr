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
import { Number as NumberPrismaModel, APIVersion, Prisma } from "@prisma/client"
import { CommonConnect as CC } from "@routr/common"
import { JsonObject } from "pb-util/build"
import { EntityManager } from "./manager"
import { TrunkManager } from "./trunk"

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
    CC.hasNameOrThrow(this.number.name)
    CC.isValidNameOrThrow(this.number.name)
    CC.hasTelUrlOrThrow(this.number.telUrl)
    CC.isValidAORLinkOrThrow(this.number.aorLink)
    CC.hasCityOrThrow(this.number.city)
    CC.hasCountryOrThrow(this.number.country)
    CC.hasCountryISOCodeOrThrow(this.number.countryIsoCode)
    CC.hasValidHeadersOrThrow(this.number.extraHeaders)
    CC.isValidSessionAffinityHeaderOrThrow(this.number.sessionAffinityHeader)
  }

  validOrThrowUpdate() {
    CC.hasRefenceOrThrow(this.number.ref)
    CC.isValidNameOrThrow(this.number.name)
    CC.isValidAORLinkOrThrow(this.number.aorLink)
    CC.hasValidHeadersOrThrow(this.number.extraHeaders)
    CC.isValidSessionAffinityHeaderOrThrow(this.number.sessionAffinityHeader)
  }

  mapToPrisma(): NumberPrismaModel {
    return {
      // TODO: Set a default value for apiVersion
      apiVersion: "v2" as APIVersion,
      ref: this.number.ref,
      name: this.number.name,
      trunkRef: this.number.trunkRef || null,
      telUrl: this.number.telUrl,
      aorLink: this.number.aorLink || null,
      city: this.number.city || undefined,
      country: this.number.country,
      countryISOCode: this.number.countryIsoCode,
      sessionAffinityHeader: this.number.sessionAffinityHeader || null,
      extraHeaders: this.number.extraHeaders || null,
      createdAt: this.number.createdAt
        ? new Date(this.number.createdAt * 1000)
        : undefined,
      updatedAt: this.number.updatedAt
        ? new Date(this.number.updatedAt * 1000)
        : undefined,
      extended: this.number.extended || {}
    }
  }

  static mapToDto(number: NumberWithTrunk): CC.INumber {
    return number
      ? {
          apiVersion: number.apiVersion,
          ref: number.ref,
          name: number.name,
          trunkRef: number.trunkRef,
          trunk: TrunkManager.mapToDto(number.trunk),
          telUrl: number.telUrl,
          aorLink: number.aorLink,
          city: number.city,
          country: number.country,
          countryIsoCode: number.countryISOCode,
          sessionAffinityHeader: number.sessionAffinityHeader,
          extraHeaders: number.extraHeaders as {
            name: string
            value: string
          }[],
          extended: number.extended as JsonObject,
          createdAt: number.createdAt.getTime() / 1000,
          updatedAt: number.updatedAt.getTime() / 1000
        }
      : undefined
  }
}

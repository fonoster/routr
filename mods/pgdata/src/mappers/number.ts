/*
 * Copyright (C) 2026 by Fonoster Inc (https://fonoster.com)
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
import { CommonConnect as CC } from "@routr/common"
import { CreateOptions, EntityManager } from "./manager"
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

  static includeFields(): Record<string, unknown> {
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

  validOrThrowCreate(options: CreateOptions = {}) {
    CC.hasTelUrlOrThrow(this.number.telUrl)
    CC.validateTelUrl({
      telUrl: this.number.telUrl,
      requireE164: options.requireE164Numbers ?? false
    })
    CC.hasNameOrThrow(this.number.name)
    CC.isValidNameOrThrow(this.number.name)
    CC.isValidAORLinkOrThrow(this.number.aorLink)
    CC.hasCityOrThrow(this.number.city)
    CC.hasCountryOrThrow(this.number.country)
    CC.hasCountryIsoCodeOrThrow(this.number.countryIsoCode)
    CC.validateCountryIsoCode({ countryIsoCode: this.number.countryIsoCode })
    CC.hasValidHeadersOrThrow(this.number.extraHeaders)
    CC.isValidSessionAffinityHeaderOrThrow(this.number.sessionAffinityHeader)
  }

  validOrThrowUpdate() {
    CC.hasReferenceOrThrow(this.number.ref)
    // Updates are partial, so only validate the name when it is sent
    if (this.number.name !== undefined) CC.isValidNameOrThrow(this.number.name)
    CC.isValidAORLinkOrThrow(this.number.aorLink)
    CC.hasValidHeadersOrThrow(this.number.extraHeaders)
    CC.isValidSessionAffinityHeaderOrThrow(this.number.sessionAffinityHeader)
  }

  mapToPrisma(): NumberPrismaModel {
    // clearAliases is an instruction of the update request, not a column
    const { clearAliases: _clearAliases, ...number } = this
      .number as CC.INumber & {
      clearAliases?: boolean
    }

    return {
      // TODO: Set a default value for apiVersion
      ...number,
      apiVersion: "v2" as APIVersion,
      trunkRef: this.number.trunkRef || null,
      sessionAffinityHeader: this.number.sessionAffinityHeader,
      extraHeaders: this.number.extraHeaders,
      createdAt: undefined,
      updatedAt: undefined,
      extended: this.number.extended as JsonValue
      // aliases is optional in a request and a column with a default
    } as NumberPrismaModel
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
          createdAt: number.createdAt.getTime() / 1000,
          updatedAt: number.updatedAt.getTime() / 1000,
          extended: number.extended as Record<string, unknown>
        }
      : undefined
  }

  // A Number under a Domain's egress policies: its Trunk is mapped when it
  // was included (an Agent's Domain includes it, a Domain alone doesn't)
  static mapToDtoNested(
    number: NumberPrismaModel & { trunk?: NumberWithTrunk["trunk"] }
  ): CC.INumber {
    if (!number) return undefined

    const { trunk, ...rest } = number

    return {
      ...rest,
      apiVersion: number.apiVersion as CC.APIVersion,
      ...(trunk ? { trunk: TrunkManager.mapToDto(trunk) } : {}),
      extraHeaders: number.extraHeaders as {
        name: string
        value: string
      }[],
      createdAt: number.createdAt.getTime() / 1000,
      updatedAt: number.updatedAt.getTime() / 1000,
      extended: number.extended as Record<string, unknown>
    }
  }
}

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
import { BadRequestError } from "../errors"
import { LoadBalancingAlgorithm } from "../types"
import { TrunkURI } from "./types"
import {
  hasACLRules,
  hasAOR,
  hasAORLink,
  hasCity,
  hasCountry,
  hasCountryISOCode,
  hasDomainUri,
  hasHost,
  hasInboundUri,
  hasName,
  hasPassword,
  hasReference,
  hasTelUrl,
  hasUsername,
  hasValidACLRules,
  hasValidHeaders,
  isValidAOR,
  isValidAORLink,
  isValidBalancingAlgorithm,
  isValidContactAddress,
  isValidDomainUri,
  isValidE164,
  isValidHost,
  isValidInboundUri,
  isValidName,
  isValidPort,
  isValidPriority,
  isValidSessionAffinityHeader,
  isValidUsername,
  isValidWeight
} from "./validations"

type ValidationMethod = (
  value: string | number | { deny: string[]; allow: string[] }
) => true | BadRequestError

type ValidationTypes = string | number | { deny: string[]; allow: string[] }

const validOrThrow = (method: ValidationMethod, value: ValidationTypes) => {
  const R = method(value)
  if (R instanceof BadRequestError) {
    throw R
  }
}

export const hasValidHeadersOrThrow = (
  headers: { name: string; value: string }[]
) => {
  const E = hasValidHeaders(headers)
  if (E instanceof BadRequestError) {
    throw E
  }
}

export const isValidBalancingAlgorithmOrThrow = (
  aor: string,
  algorithm: LoadBalancingAlgorithm
) => {
  const E = isValidBalancingAlgorithm(aor, algorithm)
  if (E instanceof BadRequestError) {
    throw E
  }
}

export const hasACLRulesOrThrow = (acl: { deny: string[]; allow: string[] }) =>
  validOrThrow(hasACLRules, acl)

export const hasValidACLRulesOrThrow = (acl: {
  deny: string[]
  allow: string[]
}) => validOrThrow(hasValidACLRules, acl)

export const hasRefenceOrThrow = (ref: string) =>
  validOrThrow(hasReference, ref)

export const hasNameOrThrow = (name: string) => validOrThrow(hasName, name)

export const isValidNameOrThrow = (name: string) =>
  validOrThrow(isValidName, name)

export const hasUsernameOrThrow = (username: string) =>
  validOrThrow(hasUsername, username)

export const isValidUsernameOrThrow = (username: string) =>
  validOrThrow(isValidUsername, username)

export const hasPasswordOrThrow = (password: string) =>
  validOrThrow(hasPassword, password)

export const hasDomainUriOrThrow = (domainUri: string) =>
  validOrThrow(hasDomainUri, domainUri)

export const isValidDomainUriOrThrow = (domainUri: string) =>
  validOrThrow(isValidDomainUri, domainUri)

export const hasTelUrlOrThrow = (telUrl: string) =>
  validOrThrow(hasTelUrl, telUrl)

export const isValidSessionAffinityHeaderOrThrow = (
  sessionAffinityHeader: string
) => validOrThrow(isValidSessionAffinityHeader, sessionAffinityHeader)

export const hasCityOrThrow = (city: string) => validOrThrow(hasCity, city)

export const hasCountryOrThrow = (country: string) =>
  validOrThrow(hasCountry, country)

export const hasCountryISOCodeOrThrow = (countryIsoCode: string) =>
  validOrThrow(hasCountryISOCode, countryIsoCode)

export const hasInboundUriOrThrow = (inboundUri: string) =>
  validOrThrow(hasInboundUri, inboundUri)

export const isValidInboundUriOrThrow = (inboundUri: string) =>
  validOrThrow(isValidInboundUri, inboundUri)

export const hasAOROrThrow = (aor: string) => validOrThrow(hasAOR, aor)

export const isValidAOROrThrow = (aor: string) => validOrThrow(isValidAOR, aor)

export const hasAORLinkOrThrow = (aorLink: string) =>
  validOrThrow(hasAORLink, aorLink)

export const isValidAORLinkOrThrow = (aorLink: string) =>
  validOrThrow(isValidAORLink, aorLink)

export const isValidContactAddressOrThrow = (contactAddress: string) =>
  validOrThrow(isValidContactAddress, contactAddress)

export const isValidE164OrThrow = (
  e164Number: string,
  countryISOCode: string,
  validateMobilePrefix: boolean
) => {
  const R = isValidE164(e164Number, countryISOCode, validateMobilePrefix)
  if (R instanceof BadRequestError) {
    throw R
  }
}

export const hasValidOutboundUrisOrThrow = (outboundUris: TrunkURI[]) =>
  outboundUris?.forEach((uri) => {
    if (hasHost(uri.host) instanceof BadRequestError) {
      throw hasHost(uri.host)
    }

    if (isValidHost(uri.host) instanceof BadRequestError) {
      throw isValidHost(uri.host)
    }

    if (isValidPort(uri.port + "") instanceof BadRequestError) {
      throw isValidPort(uri.port + "")
    }

    if (isValidPriority(uri.priority + "") instanceof BadRequestError) {
      throw isValidPriority(uri.priority + "")
    }

    if (isValidWeight(uri.weight + "") instanceof BadRequestError) {
      throw isValidWeight(uri.priority + "")
    }
  })

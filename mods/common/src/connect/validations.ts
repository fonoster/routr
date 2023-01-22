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
import * as Validator from "validator"
import { BadRequestError } from "../errors"
import { LoadBalancingAlgorithm } from "../types"

export const hasReference = (ref: string) =>
  ref ? true : new BadRequestError("the reference to the resource is required")

export const hasName = (name: string) =>
  name
    ? true
    : new BadRequestError("the friendly name for the resource is required")

export const isValidName = (name: string) => {
  return Validator.default.isLength(name, { min: 1, max: 60 })
    ? true
    : new BadRequestError("the friendly name must have less than 60 characters")
}

export const hasUsername = (username: string) =>
  username ? true : new BadRequestError("the username is required")

export const isValidUsername = (username: string) => {
  if (
    username &&
    (!Validator.default.isAlphanumeric(username) ||
      !Validator.default.isLowercase(username))
  ) {
    return new BadRequestError(
      "the username must be a lowercase, alphanumeric, and without spaces"
    )
  }
  return true
}

export const hasPassword = (password: string) =>
  password ? true : new BadRequestError("the password is required")

export const hasDomainUri = (domainUri: string) =>
  domainUri ? true : new BadRequestError("the domainUri is required")

export const isValidDomainUri = (domainUri: string) => {
  return Validator.default.isFQDN(domainUri)
    ? true
    : new BadRequestError(
        "the domainUri must be a valid fully qualified domain name"
      )
}

export const hasTelUrl = (telUrl: string) =>
  telUrl ? true : new BadRequestError("the telUrl is required")

// Supports alphanumeric, underscore, and dash (cannot end with dash)
const isValidAlphanumeric = (value: string) => {
  if (value.endsWith("-")) {
    return false
  }
  const regex = /^[a-zA-Z0-9-]+$/
  return regex.test(value)
}

export const isValidSessionAffinityHeader = (sessionAffinityHeader: string) => {
  return sessionAffinityHeader
    ? isValidAlphanumeric(sessionAffinityHeader)
      ? true
      : new BadRequestError(
          "the sessionAffinityHeader must be alphanumeric and without spaces"
        )
    : true
}

export const isValidHeader = (header: string) => {
  return header
    ? isValidAlphanumeric(header)
      ? true
      : new BadRequestError(
          "the header must be alphanumeric and without spaces"
        )
    : true
}

export const hasValidHeaders = (headers: { name: string; value: string }[]) => {
  // eslint-disable-next-line no-loops/no-loops
  for (const header of headers) {
    const E = isValidHeader(header.name) as true | BadRequestError

    if (!header.value) {
      return new BadRequestError("the header value cannot be empty")
    }

    if (E instanceof BadRequestError) {
      return E
    }
  }
  return true
}

export const hasAOR = (aor: string) =>
  aor ? true : new BadRequestError("the address of record (aor) is required")

export const isValidAOR = (aor: string) => {
  if (aor) {
    if (!aor.startsWith("backend:") && !aor.startsWith("sip:")) {
      return new BadRequestError(
        "the aor schema must start with `backend:` or `sip:`"
      )
    }
  }
  return true
}

export const hasAORLink = (aorLink: string) =>
  aorLink ? true : new BadRequestError("the aorLink is required")

export const isValidAORLink = (aorLink: string) => {
  if (aorLink) {
    if (!aorLink.startsWith("backend:") && !aorLink.startsWith("sip:")) {
      return new BadRequestError("the aorLink must start with backend: or sip:")
    }
  }
  return true
}

export const hasCity = (city: string) =>
  city ? true : new BadRequestError("the city is required")

export const hasCountry = (country: string) =>
  country ? true : new BadRequestError("the country is required")

export const hasCountryISOCode = (countryIsoCode: string) =>
  countryIsoCode ? true : new BadRequestError("the countryISOCode is required")

export const hasACLRules = (acl: { deny: string[]; allow: string[] }) => {
  if (
    !acl?.deny ||
    !acl?.allow ||
    acl.deny?.length === 0 ||
    acl.allow?.length === 0
  ) {
    return new BadRequestError("acl rules are required")
  }
  return true
}

export const isValidACLRule = (rules: string[]) => {
  // eslint-disable-next-line no-loops/no-loops
  for (const cidr of rules) {
    if (
      !Validator.default.isIPRange(cidr, 4) &&
      !Validator.default.isIP(cidr, 4)
    ) {
      return new BadRequestError(`${cidr} is not a valid cidr or ip`)
    }
  }

  return true
}

export const hasValidACLRules = (acl: {
  deny: string[]
  allow: string[]
}): true | BadRequestError => {
  const deny = isValidACLRule(acl?.deny) as true | BadRequestError

  if (deny instanceof BadRequestError) {
    return deny
  }

  const allow = isValidACLRule(acl?.allow) as true | BadRequestError
  if (allow instanceof BadRequestError) {
    return allow
  }

  return true
}

export const hasInboundUri = (inboundUri: string) =>
  inboundUri ? true : new BadRequestError("the inboundUri is required")

export const isValidInboundUri = (inboundUri: string) => {
  if (inboundUri && !Validator.default.isFQDN(inboundUri)) {
    return new BadRequestError(
      "the inbound URI must be a valid FQDN (e.g. sip.example.com)"
    )
  }
  return true
}

export const isValidBalancingAlgorithm = (
  aor: string,
  algorithm: LoadBalancingAlgorithm
) => {
  if (aor.startsWith("backend:")) {
    if (!algorithm || algorithm === LoadBalancingAlgorithm.UNSPECIFIED) {
      return new BadRequestError(
        "when the aor schema is `backend:`, the balancing algorithm is required"
      )
    }
  } else {
    if (algorithm && algorithm !== LoadBalancingAlgorithm.UNSPECIFIED) {
      return new BadRequestError(
        "when the aor schema is `sip:`, the balancing algorithm is not allowed"
      )
    }
  }
}

export const isValidPort = (port: string) => {
  if (port) {
    if (!Validator.default.isPort(port)) {
      return new BadRequestError("the port must be a valid port")
    }
  }
}

export const hasHost = (host: string) =>
  host ? true : new BadRequestError("the host is required")

export const isValidHost = (host: string) => {
  if (host) {
    if (!Validator.default.isFQDN(host) && !Validator.default.isIP(host)) {
      return new BadRequestError("the host must be a valid FQDN or IP")
    }
  }
  return true
}

export const isValidContactAddress = (contactAddress: string) => {
  if (contactAddress) {
    const hostPart = contactAddress.split(":")[0]
    const portPart = hostPart.split(":")[1] || "5060"

    if (
      !Validator.default.isFQDN(hostPart) &&
      !Validator.default.isIP(hostPart)
    ) {
      return new BadRequestError(
        "the contact address must be a valid FQDN or IP"
      )
    }

    if (!Validator.default.isPort(portPart)) {
      return new BadRequestError("the contact port must be a valid port")
    }
  }
}

export const isValidPriority = (priority: string) => {
  if (priority) {
    if (!Validator.default.isInt(priority)) {
      return new BadRequestError("the priority must be a valid integer")
    }

    const p = parseInt(priority)
    if (p < 0 || p > 65535) {
      return new BadRequestError("the priority must be between 0 and 65535")
    }
  }
}

export const isValidWeight = (weight: string) => {
  if (weight) {
    if (!Validator.default.isInt(weight)) {
      return new BadRequestError("the priority must be a valid integer")
    }

    const w = parseInt(weight)

    if (w < 1 || w > 65535) {
      return new BadRequestError("the weight must be between 1 and 65535")
    }
  }
}

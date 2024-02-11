/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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
import { CommonConnect as CC } from "@routr/common"
import { stringToACL, stringToHeaders } from "./utils"

export function nameValidator(value: string) {
  const hasName = CC.hasName(value)
  const isValidName = CC.isValidName(value)

  if (hasName instanceof Error) {
    return hasName.message
  } else if (isValidName instanceof Error) {
    return isValidName.message
  }

  return true
}

export function aclRuleValidator(value: string) {
  const hasValidACLRules = CC.isValidACLRule(stringToACL(value))

  if (stringToACL(value).length === 0) {
    return "acl rules are required"
  } else if (hasValidACLRules instanceof Error) {
    return hasValidACLRules.message
  }

  return true
}

export function usernameValidator(value: string) {
  const hasUsername = CC.hasUsername(value)
  const isValidUsername = CC.isValidUsername(value)

  if (hasUsername instanceof Error) {
    return hasUsername.message
  } else if (isValidUsername instanceof Error) {
    return isValidUsername.message
  }

  return true
}

export function optionalUsernameValidator(value: string) {
  const isValidUsername = CC.isValidUsername(value)

  if (isValidUsername instanceof Error) {
    return isValidUsername.message
  }

  return true
}

export function sessionAffinityHeaderValidator(value: string) {
  const isValidSessionAffinityHeader = CC.isValidSessionAffinityHeader(value)

  if (isValidSessionAffinityHeader instanceof Error) {
    return isValidSessionAffinityHeader.message
  }

  return true
}

export function headersValidator(value: string) {
  const headers = stringToHeaders(value)
  const hasValidHeaders = CC.hasValidHeaders(headers)

  if (hasValidHeaders instanceof Error) {
    return hasValidHeaders.message
  }

  return true
}

export function aorValidator(value: string) {
  const hasAOR = CC.hasAOR(value)
  const isValidAOR = CC.isValidAOR(value)

  if (hasAOR instanceof Error) {
    return hasAOR.message
  } else if (isValidAOR instanceof Error) {
    return isValidAOR.message
  }

  return true
}

export function aorLinkValidator(value: string) {
  const isValidAORLink = CC.isValidAORLink(value)

  if (isValidAORLink instanceof Error) {
    return isValidAORLink.message
  }

  return true
}

export function telUrlValidator(value: string) {
  const hasTelUrl = CC.hasTelUrl(value)

  if (hasTelUrl instanceof Error) {
    return hasTelUrl.message
  }

  return true
}

export function inboundUriValidator(value: string) {
  const hasInboundUri = CC.hasInboundUri(value)
  const isValidInboundUri = CC.isValidInboundUri(value)

  if (hasInboundUri instanceof Error) {
    return hasInboundUri.message
  } else if (isValidInboundUri instanceof Error) {
    return isValidInboundUri.message
  }

  return true
}

export function contactAddrValidator(value: string) {
  const isValidContactAddress = CC.isValidContactAddress(value)

  if (isValidContactAddress instanceof Error) {
    return isValidContactAddress.message
  }

  return true
}

export function hostValidator(value: string) {
  const hasHost = CC.hasHost(value)
  const isValidHost = CC.isValidHost(value)

  if (hasHost instanceof Error) {
    return hasHost.message
  } else if (isValidHost instanceof Error) {
    return isValidHost.message
  }

  return true
}

export function portValidator(value: string) {
  const isValidPort = CC.isValidPort(value)

  if (isValidPort instanceof Error) {
    return isValidPort.message
  }

  return true
}

export function weightValidator(value: string) {
  const isValidWeight = CC.isValidWeight(value)

  if (isValidWeight instanceof Error) {
    return isValidWeight.message
  }

  return true
}

export function priorityValidator(value: string) {
  const isValidPriority = CC.isValidPriority(value)

  if (isValidPriority instanceof Error) {
    return isValidPriority.message
  }

  return true
}

export function domainUriValidator(value: string) {
  const hasDomainUri = CC.hasDomainUri(value)
  const isValidDomainUri = CC.isValidDomainUri(value)

  if (hasDomainUri instanceof Error) {
    return hasDomainUri.message
  } else if (isValidDomainUri instanceof Error) {
    return isValidDomainUri.message
  }

  return true
}

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
import { getLogger } from "@fonoster/logger"
import { Privacy } from "../types"
import { UserConfig } from "./config"
import {
  AccessControlList,
  Agent,
  Credentials,
  Domain,
  INumber,
  Kind,
  Peer,
  Trunk
} from "./types"

const logger = getLogger({ service: "simpledata", filePath: __filename })

const findByRef = (ref: string, list: UserConfig[]) => {
  const resource = list.find((r) => r.ref === ref)
  if (ref != null && resource == null) {
    logger.error(
      `the resource with ref ${ref} does not exist in the configuration file; exiting`
    )
    process.exit(1)
  }

  return resource ? getConverter(resource.kind)(resource, list) : null
}

export const getConverter = (kind: string) => {
  switch (kind) {
    case Kind.AGENT:
      return convertAgentConfigToAgent
    case Kind.DOMAIN:
      return convertDomainConfigToDomain
    case Kind.PEER:
      return convertPeerConfigToPeer
    case Kind.NUMBER:
      return convertNumberConfigToNumber
    case Kind.TRUNK:
      return convertTrunkConfigToTrunk
    case Kind.CREDENTIALS:
      return convertCredentialsConfigToCredentials
    case Kind.ACL:
      return convertACLConfigToACL
  }
}

export function convertAgentConfigToAgent(
  config: UserConfig,
  list: UserConfig[]
): Agent {
  if (config.kind !== Kind.AGENT)
    throw new Error("invalid resource type `Agent`")

  return {
    apiVersion: config.apiVersion,
    ref: config.ref,
    name: config.metadata.name,
    username: config.spec.username,
    privacy: (config.spec.privacy?.toLowerCase() as Privacy) ?? Privacy.NONE,
    enabled: config.spec.enabled as boolean,
    domain: findByRef(config.spec.domainRef, list) as Domain,
    credentials: findByRef(config.spec.credentialsRef, list) as Credentials
  }
}

export function convertDomainConfigToDomain(
  config: UserConfig,
  list: UserConfig[]
): Domain {
  if (config.kind !== Kind.DOMAIN)
    throw new Error("invalid resource type `Domain`")

  const egressPolicies = config.spec.context.egressPolicies?.map(
    (policy: { rule: string; numberRef: string }) => {
      return {
        rule: policy.rule,
        number: findByRef(policy.numberRef, list) as INumber
      }
    }
  )

  return {
    apiVersion: config.apiVersion,
    ref: config.ref,
    name: config.metadata.name,
    domainUri: config.spec.context.domainUri,
    accessControlList: findByRef(
      config.spec.accessControlListRef,
      list
    ) as AccessControlList,
    egressPolicies
  }
}

export function convertPeerConfigToPeer(
  config: UserConfig,
  list: UserConfig[]
): Peer {
  if (config.kind !== Kind.PEER) throw new Error("invalid resource type `Peer`")

  return {
    apiVersion: config.apiVersion,
    ref: config.ref,
    name: config.metadata.name,
    username: config.spec.username,
    aor: config.spec.aor,
    contactAddr: config.spec.contactAddr,
    enabled: config.spec.enabled as boolean,
    credentials: findByRef(config.spec.credentialsRef, list) as Credentials
  }
}

export function convertNumberConfigToNumber(
  config: UserConfig,
  list: UserConfig[]
): INumber {
  if (config.kind !== Kind.NUMBER)
    throw new Error("invalid resource type `Number`")

  const metadata = config.metadata
  const location = config.spec.location
  return {
    apiVersion: config.apiVersion,
    ref: config.ref,
    name: metadata.name,
    city: metadata.geoInfo.city,
    country: metadata.geoInfo.country,
    countryIsoCode: metadata.geoInfo.countryISOCode,
    telUrl: location.telUrl,
    aorLink: location.aorLink,
    sessionAffinityHeader: location.sessionAffinityHeader,
    extraHeaders: location.extraHeaders,
    trunk: findByRef(config.spec.trunkRef, list) as Trunk
  }
}

export function convertTrunkConfigToTrunk(
  config: UserConfig,
  list: UserConfig[]
): Trunk {
  if (config.kind !== Kind.TRUNK)
    throw new Error("invalid resource type `Trunk`")

  const inbound = config.spec.inbound
  const outbound = config.spec.outbound
  return {
    apiVersion: config.apiVersion,
    ref: config.ref,
    name: config.metadata.name,
    sendRegister: outbound.sendRegister,
    inboundUri: inbound.uri,
    inboundCredentials: findByRef(inbound.credentialsRef, list) as Credentials,
    outboundCredentials: findByRef(
      outbound.credentialsRef,
      list
    ) as Credentials,
    accessControlList: findByRef(
      inbound.accessControlListRef,
      list
    ) as AccessControlList,
    uris: config.spec.outbound.uris?.map((entry) => {
      return {
        user: entry.uri.user,
        host: entry.uri.host,
        port: entry.uri.port,
        transport: entry.uri.transport,
        enabled: entry.enabled,
        weight: entry.weight,
        priority: entry.priority
      }
    })
  }
}

export function convertCredentialsConfigToCredentials(
  config: UserConfig
): Credentials {
  if (config.kind !== Kind.CREDENTIALS)
    throw new Error("invalid resource type `Credentials`")

  return {
    apiVersion: config.apiVersion,
    ref: config.ref,
    name: config.metadata.name,
    username: config.spec.credentials.username,
    password: config.spec.credentials.password
  }
}

export function convertACLConfigToACL(config: UserConfig): AccessControlList {
  if (config.kind !== Kind.ACL)
    throw new Error("invalid resource type `AccessControlList`")

  return {
    apiVersion: config.apiVersion,
    ref: config.ref,
    name: config.metadata.name,
    allow: config.spec.accessControlList?.allow ?? [],
    deny: config.spec.accessControlList?.deny ?? []
  }
}

/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
import { getLogger } from "@fonoster/logger"
import { CommonConnect as CC } from "@routr/common"

const logger = getLogger({ service: "simpledata", filePath: __filename })

const findByRef = (ref: string, list: CC.UserConfig[]) => {
  const resource = list.find((r) => r.ref === ref)
  if (ref != null && resource == null) {
    logger.error(
      `the resource with ref ${ref} does not exist in the configuration file; exiting`
    )
    process.exit(1)
  }

  return resource ? getLoader(resource.kind)(resource, list) : null
}

export const getLoader = (kind: string) => {
  switch (kind) {
    case CC.Kind.AGENT:
      return agentLoader
    case CC.Kind.DOMAIN:
      return domainLoader
    case CC.Kind.PEER:
      return peerLoader
    case CC.Kind.NUMBER:
      return numberLoader
    case CC.Kind.TRUNK:
      return trunkLoader
    case CC.Kind.CREDENTIALS:
      return credentialsLoader
    case CC.Kind.ACL:
      return aclLoader
  }
}

export function agentLoader(
  config: CC.UserConfig,
  list: CC.UserConfig[]
): CC.Agent {
  if (config.kind !== CC.Kind.AGENT)
    throw new Error("invalid resource type `Agent`")

  const agent = CC.mapToAgent(config)
  agent.domain = findByRef(config.spec.domainRef, list) as CC.Domain
  agent.credentials = findByRef(
    config.spec.credentialsRef,
    list
  ) as CC.Credentials

  return agent
}

export function domainLoader(
  config: CC.UserConfig,
  list: CC.UserConfig[]
): CC.Domain {
  if (config.kind !== CC.Kind.DOMAIN)
    throw new Error("invalid resource type `Domain`")

  const egressPolicies = config.spec.context.egressPolicies?.map(
    (policy: { rule: string; numberRef: string }) => {
      return {
        rule: policy.rule,
        numberRef: policy.numberRef,
        number: findByRef(policy.numberRef, list) as CC.INumber
      }
    }
  )

  const domain = CC.mapToDomain(config)
  domain.egressPolicies = egressPolicies
  domain.accessControlList = findByRef(
    config.spec.accessControlListRef,
    list
  ) as CC.AccessControlList

  return domain
}

export function peerLoader(
  config: CC.UserConfig,
  list: CC.UserConfig[]
): CC.Peer {
  if (config.kind !== CC.Kind.PEER)
    throw new Error("invalid resource type `Peer`")

  const peer = CC.mapToPeer(config)
  peer.credentials = findByRef(
    config.spec.credentialsRef,
    list
  ) as CC.Credentials

  return peer
}

export function numberLoader(
  config: CC.UserConfig,
  list: CC.UserConfig[]
): CC.INumber {
  if (config.kind !== CC.Kind.NUMBER)
    throw new Error("invalid resource type `Number`")

  const number = CC.mapToNumber(config)
  number.trunk = findByRef(config.spec.trunkRef, list) as CC.Trunk

  return number
}

export function trunkLoader(
  config: CC.UserConfig,
  list: CC.UserConfig[]
): CC.Trunk {
  if (config.kind !== CC.Kind.TRUNK)
    throw new Error("invalid resource type `Trunk`")

  const inbound = config.spec.inbound
  const outbound = config.spec.outbound
  const trunk = CC.mapToTrunk(config)

  trunk.inboundCredentials = findByRef(
    inbound.credentialsRef,
    list
  ) as CC.Credentials
  trunk.outboundCredentials = findByRef(
    outbound.credentialsRef,
    list
  ) as CC.Credentials
  trunk.accessControlList = findByRef(
    inbound.accessControlListRef,
    list
  ) as CC.AccessControlList

  return trunk
}

export function credentialsLoader(config: CC.UserConfig): CC.Credentials {
  if (config.kind !== CC.Kind.CREDENTIALS)
    throw new Error("invalid resource type `Credentials`")

  return CC.mapToCredentials(config)
}

export function aclLoader(config: CC.UserConfig): CC.AccessControlList {
  if (config.kind !== CC.Kind.ACL)
    throw new Error("invalid resource type `AccessControlList`")

  return CC.mapToACL(config)
}

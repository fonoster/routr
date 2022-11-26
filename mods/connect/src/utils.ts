/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
 *
 * Licensed under the MIT License (the "License")
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
import { HeaderModifier, MessageRequest, Transport } from "@routr/common"
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"
import { ROUTING_DIRECTION } from "./types"

export const isKind = (res: CC.Resource, kind: CC.KIND) => {
  if (res == null && kind === CC.KIND.UNKNOWN) {
    return true
  }
  return res?.kind.toLowerCase() === kind
}

export const findDomain = async (dataAPI: CC.DataAPI, domainUri: string) => {
  return (
    await dataAPI.findBy({
      kind: CC.KIND.DOMAIN,
      criteria: CC.FindCriteria.FIND_DOMAIN_BY_DOMAINURI,
      parameters: {
        domainUri
      }
    })
  )[0]
}

export const findResource = async (
  dataAPI: CC.DataAPI,
  domainUri: string,
  userpart: string
): Promise<CC.Resource> => {
  const domain = await findDomain(dataAPI, domainUri)

  // TODO: Fix jsonpath not working for logical AND and OR
  let res = (
    await dataAPI.findBy({
      kind: CC.KIND.NUMBER,
      criteria: CC.FindCriteria.FIND_NUMBER_BY_TELURL,
      parameters: {
        telUrl: `tel:${userpart}`
      }
    })
  )[0]

  res =
    res == null
      ? (
          await dataAPI.findBy({
            kind: CC.KIND.AGENT,
            criteria: CC.FindCriteria.FIND_AGENT_BY_USERNAME,
            parameters: {
              username: userpart
            }
          })
        )[0]
      : res

  if (
    isKind(res, CC.KIND.AGENT) &&
    res.spec.domainRef != domain?.metadata.ref
  ) {
    // Not in the same domain
    return null
  }
  return res
}

export const getRoutingDirection = (
  caller: CC.Resource,
  callee: CC.Resource
) => {
  if (isKind(caller, CC.KIND.AGENT) && isKind(callee, CC.KIND.AGENT)) {
    return ROUTING_DIRECTION.AGENT_TO_AGENT
  }

  if (isKind(caller, CC.KIND.AGENT) && isKind(callee, CC.KIND.UNKNOWN)) {
    return ROUTING_DIRECTION.AGENT_TO_PSTN
  }

  if (isKind(caller, CC.KIND.PEER) && isKind(callee, CC.KIND.AGENT)) {
    return ROUTING_DIRECTION.PEER_TO_AGENT
  }

  // All we know is that the Number is managed by this instance of Routr
  if (isKind(callee, CC.KIND.NUMBER)) {
    return ROUTING_DIRECTION.FROM_PSTN
  }

  if (isKind(caller, CC.KIND.PEER) && isKind(callee, CC.KIND.UNKNOWN)) {
    return ROUTING_DIRECTION.PEER_TO_PSTN
  }

  return ROUTING_DIRECTION.UNKNOWN
}

export const createPAssertedIdentity = (
  req: MessageRequest,
  trunk: CC.Resource,
  number: CC.Resource
): HeaderModifier => {
  const displayName = req.message.from.address.displayName
  const remoteNumber = number.spec.location.telUrl.split(":")[1]
  const trunkHost = getTrunkURI(trunk).host
  return {
    name: "P-Asserted-Identity",
    value: displayName
      ? `"${displayName}" <sip:${remoteNumber}@${trunkHost};user=phone>`
      : `<sip:${remoteNumber}@${trunkHost};user=phone>`,
    action: CT.HeaderModifierAction.ADD
  }
}

export const createRemotePartyId = (
  trunk: CC.Resource,
  number: CC.Resource
): HeaderModifier => {
  const remoteNumber = number.spec.location.telUrl.split(":")[1]
  const trunkHost = getTrunkURI(trunk).host
  return {
    name: "Remote-Party-ID",
    value: `<sip:${remoteNumber}@${trunkHost}>;screen=yes;party=calling`,
    action: CT.HeaderModifierAction.ADD
  }
}

export const createTrunkAuthentication = async (
  dataAPI: CC.DataAPI,
  trunk: CC.Resource
): Promise<HeaderModifier> => {
  const credentials = await dataAPI.get(trunk.spec.outbound.credentialsRef)
  return {
    name: CT.ExtraHeader.GATEWAY_AUTH,
    value: Buffer.from(
      `${credentials.spec.credentials.username}:${credentials.spec.credentials.password}`
    ).toString("base64"),
    action: CT.HeaderModifierAction.ADD
  }
}

export const getTrunkURI = (
  trunk: CC.Resource
): {
  host: string
  port: number
  user: string
  transport: Transport
} => {
  const { user, host, port, transport } = trunk.spec.outbound?.uris[0].uri
  const t = !transport
    ? (Transport.UDP as Transport)
    : (Object.keys(Transport)[
        Object.values(Transport).indexOf(transport.toUpperCase())
      ] as unknown as Transport)
  return {
    user,
    host,
    port: port ?? 5060,
    transport: t
  }
}

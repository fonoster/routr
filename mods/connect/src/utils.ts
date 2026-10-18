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
import * as grpc from "@grpc/grpc-js"
import * as jwt from "jsonwebtoken"
import {
  CONNECT_VERIFIER_ADDR,
  CONNECT_VERIFIER_OPTIONS,
  CONNECT_VERIFIER_PUBLIC_KEY_PATH
} from "./envs"
import fs from "fs"
import {
  HeaderModifier,
  MessageRequest,
  Transport,
  CommonConnect as CC,
  CommonTypes as CT,
  IpUtils,
  Verifier as V
} from "@routr/common"
import { Extensions as E } from "@routr/processor"
import { RoutingDirection } from "./types"

// OMG, this is so ugly and hacky
export const isKind = (res: CC.RoutableResourceUnion, kind: CC.Kind) => {
  if (res == null && kind === CC.Kind.UNKNOWN) {
    return true
  } else if (res == null) {
    return false
  } else if ("privacy" in res && kind === CC.Kind.AGENT) {
    return true
  } else if ("telUrl" in res && kind === CC.Kind.NUMBER) {
    return true
  } else if ("username" in res && kind === CC.Kind.PEER) {
    return true
  }
}

export const findDomain = async (
  apiClient: CC.APIClient,
  domainUri: string
) => {
  return (
    await apiClient.domains.findBy({
      fieldName: "domainUri",
      fieldValue: domainUri
    })
  ).items[0]
}

export const findNumberByTelUrl = async (
  apiClient: CC.APIClient,
  telUrl: string
) => {
  return (
    await apiClient.numbers.findBy({
      fieldName: "telUrl",
      fieldValue: telUrl
    })
  ).items[0]
}

export const findResource = async (
  apiClient: CC.APIClient,
  domainUri: string,
  userpart: string
): Promise<CC.RoutableResourceUnion> => {
  try {
    const domain = await findDomain(apiClient, domainUri)

    // First, try to find a number
    const number = await findNumberByTelUrl(apiClient, `tel:${userpart}`)

    if (number != null) return number

    // Next, try to find an agent
    const agent = (
      await apiClient.agents.findBy({
        fieldName: "username",
        fieldValue: userpart
      })
    ).items[0]

    if (agent && agent.domain.ref != domain?.ref) {
      // Not in the same domain
      return null
    }

    if (agent != null) return agent

    // Next, try to find a peer
    return (
      await apiClient.peers.findBy({
        fieldName: "username",
        fieldValue: userpart
      })
    ).items[0]
  } catch (err) {
    if (err.code === grpc.status.NOT_FOUND) {
      return null
    }
  }
}

export const getRoutingDirection = (
  caller: CC.RoutableResourceUnion,
  callee: CC.RoutableResourceUnion
) => {
  if (isKind(caller, CC.Kind.AGENT) && isKind(callee, CC.Kind.AGENT)) {
    return RoutingDirection.AGENT_TO_AGENT
  }

  if (isKind(caller, CC.Kind.AGENT) && isKind(callee, CC.Kind.UNKNOWN)) {
    return RoutingDirection.AGENT_TO_PSTN
  }

  if (isKind(caller, CC.Kind.PEER) && isKind(callee, CC.Kind.AGENT)) {
    return RoutingDirection.PEER_TO_AGENT
  }

  if (isKind(caller, CC.Kind.AGENT) && isKind(callee, CC.Kind.PEER)) {
    return RoutingDirection.AGENT_TO_PEER
  }

  // All we know is that the Number is managed by this instance of Routr
  if (isKind(callee, CC.Kind.NUMBER)) {
    return RoutingDirection.FROM_PSTN
  }

  if (isKind(caller, CC.Kind.PEER) && isKind(callee, CC.Kind.UNKNOWN)) {
    return RoutingDirection.PEER_TO_PSTN
  }

  return RoutingDirection.UNKNOWN
}

export const createPAssertedIdentity = (
  req: MessageRequest,
  trunk: CC.Trunk,
  number: CC.INumber
): HeaderModifier => {
  const displayName = req.message.from.address.displayName
  const remoteNumber = number.telUrl.split(":")[1]
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
  trunk: CC.Trunk,
  number: CC.INumber
): HeaderModifier => {
  const remoteNumber = number.telUrl.split(":")[1]
  const trunkHost = getTrunkURI(trunk).host
  return {
    name: "Remote-Party-ID",
    value: `<sip:${remoteNumber}@${trunkHost}>;screen=yes;party=calling`,
    action: CT.HeaderModifierAction.ADD
  }
}

// Q: Why is this a promise?
export const createTrunkAuthentication = async (
  trunk: CC.Trunk
): Promise<HeaderModifier> => {
  return {
    name: CT.ExtraHeader.GATEWAY_AUTH,
    value: Buffer.from(
      `${trunk.outboundCredentials?.username}:${trunk.outboundCredentials?.password}`
    ).toString("base64"),
    action: CT.HeaderModifierAction.ADD
  }
}

export const getTrunkURI = (
  trunk: CC.Trunk
): {
  host: string
  port: number
  user: string
  transport: Transport
} => {
  if (!trunk.uris) {
    throw new Error(`trunk ${trunk.ref} has no outbound settings`)
  }

  const { user, host, port, transport } = trunk.uris[0]

  return {
    user,
    host,
    port: port ?? 5060,
    transport: transport ?? Transport.UDP
  }
}

export const getSipUri = (uri: { user?: string; host: string }) =>
  uri.user ? `sip:${uri.user}@${uri.host}` : `sip:${uri.host}`

export const hasXConnectObjectHeader = (req: MessageRequest) =>
  E.getHeaderValue(req, CT.ExtraHeader.CONNECT_TOKEN)

export const getVerifierImpl = () => {
  if (CONNECT_VERIFIER_PUBLIC_KEY_PATH) {
    const publicKey = fs.readFileSync(CONNECT_VERIFIER_PUBLIC_KEY_PATH, "utf8")

    return {
      verify: async (token: string): Promise<V.VerifyResponse> => {
        return jwt.verify(
          token,
          publicKey,
          CONNECT_VERIFIER_OPTIONS
        ) as unknown as V.VerifyResponse
      }
    }
  } else if (CONNECT_VERIFIER_ADDR) {
    return { verify: V.verifier(CONNECT_VERIFIER_ADDR) }
  }

  return null
}

/**
 * Returns the headers that must be removed from a request before it is forwarded.
 *
 * Requests from authenticated Agents and Peers are trusted and keep their headers.
 * Requests from the PSTN, and requests authorized only by a Connect Token, are not:
 * the platform headers in `headers` are removed so a caller can't spoof them.
 * A client using a verified Connect Token keeps its X-App-Ref.
 *
 * @param {RoutingDirection} direction - The routing direction of the request
 * @param {boolean} withConnectToken - Whether the request carried a verified X-Connect-Token
 * @param {string[]} headers - The headers to strip from untrusted requests
 * @return {string[]} The headers to remove
 */
export const getUntrustedHeadersToStrip = (
  direction: RoutingDirection,
  withConnectToken: boolean,
  headers: string[]
): string[] => {
  if (withConnectToken) {
    return headers.filter(
      (h) => h.toLowerCase() !== CT.ExtraHeader.APP_REF.toLowerCase()
    )
  }

  if (
    direction === RoutingDirection.FROM_PSTN ||
    direction === RoutingDirection.UNKNOWN
  ) {
    return headers
  }

  return []
}

export interface EdgePortTrust {
  // Accepted X-Edgeport-Ref values. Empty means any ref from a trusted address.
  refs: string[]
  // IPs or CIDRs of the peer EdgePorts. Empty means no peer EdgePort is trusted.
  addresses: string[]
}

/**
 * Returns the address the request came from: the top Via's "received" value,
 * which the SIP stack sets when the packet's source differs from the Via host
 * (RFC 3261 §18.2.1), or the Via host otherwise.
 *
 * @param {MessageRequest} request - The request
 * @return {string | undefined} The source address
 */
export const getSourceAddress = (
  request: MessageRequest
): string | undefined => {
  const via = request.message?.via?.[0]
  return via?.received || via?.host
}

/**
 * Tells whether a request carrying X-Edgeport-Ref was forwarded by a trusted peer
 * EdgePort. Only such a request may take the last-message fast path, which skips
 * routing and access checks. The header value alone proves nothing (anyone can
 * set it), so the request's source address must be in `trust.addresses`; when
 * `trust.refs` is not empty, the header value must also be one of them.
 *
 * @param {MessageRequest} request - The request
 * @param {EdgePortTrust} trust - The trusted peer EdgePorts
 * @return {boolean} true if the request comes from a trusted peer EdgePort
 */
export const isFromTrustedEdgePort = (
  request: MessageRequest,
  trust: EdgePortTrust
): boolean => {
  const ref = E.getHeaderValue(request, CT.ExtraHeader.EDGEPORT_REF)
  if (!ref || trust.addresses.length === 0) return false
  if (trust.refs.length > 0 && !trust.refs.includes(ref)) return false

  const addr = getSourceAddress(request)
  if (!addr) return false

  return trust.addresses.some((net) => {
    try {
      return IpUtils.hasIp(net, addr)
    } catch (e) {
      // Invalid net, or a source that is not an IP address
      return false
    }
  })
}

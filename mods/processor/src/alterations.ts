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
import {
  HeaderModifier,
  Helper as H,
  MessageRequest,
  Route,
  CommonTypes,
  Transport,
  NetInterface,
  Identity as I,
  IpUtils
} from "@routr/common"
import { isIPv4, isIPv6 } from "net"
import { phone } from "phone"
import { getEdgeInterface } from "./helper"

const {
  IDENTITY_PARAMETERS,
  encodeIdentity,
  encodeIdentityUser,
  decodeIdentity,
  decodeIdentityUser,
  portOf
} = I
type Identity = I.Identity

// Forces the requestURI to be the same as the trunk uri.
// This is a workaround for Twilio.
export const fixRequestURI =
  (route: Route) =>
  (request: MessageRequest): MessageRequest => {
    const req = H.deepCopy(request)
    if (route.registeredOn && route.user) {
      req.message.requestUri.user = route.user
    }
    req.message.requestUri.host = route.host
    req.message.requestUri.port = route.port
    req.message.requestUri.transportParam = route.transport
    return req
  }

export const addSelfVia =
  (route: Route) =>
  (request: MessageRequest): MessageRequest => {
    const req = H.deepCopy(request)

    const routingObjects =
      request.edgePortRef === route.edgePortRef ? route : request

    const targetIntf = getEdgeInterface({
      ...routingObjects,
      endpointIntf: route
    })

    req.message.via = [
      {
        ...targetIntf,
        rPortFlag: true
      },
      ...req.message.via
    ]

    return req
  }

export const addSelfViaUsingTheRouteHeaders = (
  request: MessageRequest
): MessageRequest => {
  const req = H.deepCopy(request)
  const routes = request.message.route

  // WARNING: Perhaps we should use the request uri as the target if no route is found
  if (routes.length === 0) {
    return req
  }

  // If there is only one route, then we use it as the egress interface
  const egressRouteHeader = routes.length === 1 ? routes[0] : routes[1]
  const targetIntf = {
    host: egressRouteHeader.address.uri.host,
    port: egressRouteHeader.address.uri.port,
    transport:
      (egressRouteHeader.address.uri.transportParam?.toUpperCase() as Transport) ||
      Transport.UDP
  } as NetInterface

  req.message.via = [
    {
      ...targetIntf,
      rPortFlag: true
    },
    ...req.message.via
  ]

  return req
}

// Experimental
export const addSelfViaUsingExternalAddrs = (
  request: MessageRequest
): MessageRequest => {
  const req = H.deepCopy(request)

  const targetIntf = getEdgeInterface({
    ...request,
    endpointIntf: {
      host: request.message.requestUri.host,
      port: request.message.requestUri.port,
      transport: request.message.requestUri.transportParam
    }
  })

  req.message.via = [
    {
      ...targetIntf,
      rPortFlag: true
    },
    ...req.message.via
  ]

  return req
}

export const addRouteToNextHop =
  (route: Route) =>
  (request: MessageRequest): MessageRequest => {
    if (request.message.requestUri.host === route.host) {
      return request
    }

    const req = H.deepCopy(request)
    const r = {
      address: {
        uri: {
          host: route.host,
          port: route.port,
          transportParam: route.transport,
          lrParam: true
        }
      }
    } as CommonTypes.RouteHeader
    req.message.route = [r, ...req.message.route]
    return req
  }

export const addRouteToPeerEdgePort =
  (route: Route) =>
  (request: MessageRequest): MessageRequest => {
    const req = H.deepCopy(request)
    const targetIntf = getEdgeInterface({
      listeningPoints: route.listeningPoints,
      localnets: route.localnets,
      externalAddrs: route.externalAddrs,
      endpointIntf: route
    })
    const r = {
      address: {
        uri: {
          host: targetIntf.host,
          port: targetIntf.port,
          transportParam: targetIntf.transport,
          lrParam: true
        }
      }
    } as CommonTypes.RouteHeader
    req.message.route = [r, ...req.message.route]
    return req
  }

export const applyXHeaders =
  (route: Route) =>
  (request: MessageRequest): MessageRequest => {
    const req = H.deepCopy(request)
    if (route.headers?.length > 0) {
      const headersToRemove = route.headers
        .filter(
          (h: HeaderModifier) =>
            h.action === CommonTypes.HeaderModifierAction.REMOVE
        )
        .map((h) => h.name.toLowerCase())

      const headersToAdd = route.headers.filter(
        (h: HeaderModifier) => h.action === CommonTypes.HeaderModifierAction.ADD
      )

      // An added header replaces any copy already in the request (case-insensitive),
      // so a caller-supplied value can never sit next to the one Routr adds.
      const headersToReplace = headersToAdd.map((h) => h.name.toLowerCase())

      req.message.extensions = req.message.extensions.filter(
        (h: CommonTypes.Extension) =>
          !headersToRemove.includes(h.name.toLowerCase()) &&
          !headersToReplace.includes(h.name.toLowerCase())
      )

      headersToAdd.forEach((h: HeaderModifier) => {
        req.message.extensions.push({ name: h.name, value: h.value })
      })
    }
    return req
  }

// The parameters argument is the identity mapping from identityRewriteParameters.
// It goes in the URI user part of every Record-Route entry this adds, which a
// user agent keeps (RFC 3261 section 12.1.2), so a rewritten From or To comes
// back on the dialog's later requests (see swapIdentityFromRouteSet).
export const addSelfRecordRoute =
  (route: Route, parameters: Record<string, string> = {}) =>
  (request: MessageRequest): MessageRequest => {
    const req = H.deepCopy(request)
    const user = encodeIdentityUser(parameters)
    const originIntf = getEdgeInterface({
      listeningPoints: request.listeningPoints,
      localnets: request.localnets,
      externalAddrs: request.externalAddrs,
      endpointIntf: request.sender
    })

    const target = {
      host: route.advertisedHost,
      port: route.advertisedPort,
      transport: route.transport
    }

    const targetIntf = getEdgeInterface({
      listeningPoints: request.listeningPoints,
      localnets: request.localnets,
      externalAddrs: request.externalAddrs,
      endpointIntf: target
    })

    const originRoute: CommonTypes.RecordRoute = {
      address: {
        uri: {
          ...(user ? { user } : {}),
          host: originIntf.host,
          port: originIntf.port,
          transportParam: originIntf.transport,
          lrParam: true
        }
      }
    }

    if (
      originIntf.host !== targetIntf.host ||
      originIntf.port !== targetIntf.port ||
      originIntf.transport !== targetIntf.transport
    ) {
      const targetRoute: CommonTypes.RecordRoute = {
        address: {
          uri: {
            ...(user ? { user } : {}),
            host: targetIntf.host,
            port: targetIntf.port,
            transportParam: targetIntf.transport,
            lrParam: true
          }
        },
        parameters: {
          r2: "on"
        }
      }

      // Add r2 on to origin route
      originRoute.parameters = {
        r2: "on"
      }

      req.message.recordRoute = [
        targetRoute,
        originRoute,
        ...req.message.recordRoute
      ]
    } else {
      req.message.recordRoute = [originRoute, ...req.message.recordRoute]
    }

    return req
  }

export const addXEdgePortRef = (request: MessageRequest): MessageRequest => {
  const req = H.deepCopy(request)
  const r = {
    name: CommonTypes.ExtraHeader.EDGEPORT_REF,
    value: request.edgePortRef
  }
  req.message.extensions = [r, ...req.message.extensions]
  return req
}

export const removeXEdgePortRef = (request: MessageRequest): MessageRequest => {
  const req = H.deepCopy(request)
  req.message.extensions = req.message.extensions.filter(
    (ext: CommonTypes.Extension) =>
      ext.name.toLowerCase() !==
      CommonTypes.ExtraHeader.EDGEPORT_REF.toLowerCase()
  )
  return req
}

// Removes every extension whose name matches one of the given names (case-insensitive)
export const removeHeaders =
  (names: string[]) =>
  (request: MessageRequest): MessageRequest => {
    if (!names || names.length === 0) return request
    const req = H.deepCopy(request)
    const toRemove = names.map((n) => n.toLowerCase())
    req.message.extensions = req.message.extensions.filter(
      (ext: CommonTypes.Extension) => !toRemove.includes(ext.name.toLowerCase())
    )
    return req
  }

export const removeAuthorization = (
  request: MessageRequest
): MessageRequest => {
  const req = H.deepCopy(request)
  delete req.message.authorization
  return req
}

// Whether a Route entry points at this EdgePort (one of its local or external
// addresses or aliases, on the port of the matching listening point). Aliases
// compare case-insensitively (RFC 3261 section 19.1.4)
const isSelfRoute =
  (request: MessageRequest) =>
  (r: CommonTypes.RouteHeader): boolean => {
    const localIps = request.localnets.map((ln) => ln.split("/")[0])
    // A Route on a transport this EdgePort does not listen on is not this
    // EdgePort's: it stays for the next hop (RFC 3261 section 16.4), as in
    // Connect and the Go SDK
    const transport =
      r.address.uri.transportParam?.toUpperCase() || Transport.UDP
    const lp = request.listeningPoints.find(
      (lp) => lp.transport.toUpperCase() === transport
    )
    if (!lp) return false

    const routeUri = r.address.uri
    const aliases = (request.aliases || []).map((a) => a.toLowerCase())
    return (
      (localIps.includes(routeUri.host) ||
        request.externalAddrs.includes(routeUri.host) ||
        aliases.includes(routeUri.host?.toLowerCase())) &&
      routeUri.port === lp.port
    )
  }

export const removeSelfRoutes = (request: MessageRequest): MessageRequest => {
  const req = H.deepCopy(request)
  req.message.route = req.message.route.filter(
    (r: CommonTypes.RouteHeader) => !isSelfRoute(request)(r)
  )
  return req
}

export const removeTopVia = (request: MessageRequest): MessageRequest => {
  const req = H.deepCopy(request)
  req.message.via.shift()
  return req
}

export const decreaseMaxForwards = (request: MessageRequest) => {
  const req = H.deepCopy(request)
  if (req.message.maxForwards) {
    req.message.maxForwards.maxForwards =
      req.message.maxForwards.maxForwards - 1
  }
  return req
}

export const fixInvalidContact = (request: MessageRequest) => {
  const req = H.deepCopy(request)
  const via = req.message.via[0]

  if (req.message.contact?.address.uri.host.includes(".invalid")) {
    req.message.contact.address.uri.host = via.received || via.host
    req.message.contact.address.uri.port =
      via.rPort !== -1 ? via.rPort : via.port
    req.message.contact.address.uri.transportParam =
      via.transport.toUpperCase() as Transport
  }

  return req
}

export const overwriteContactWithSenderInfo = (request: MessageRequest) => {
  const req = H.deepCopy(request)

  if (req.message.contact) {
    req.message.contact.address.uri.host = req.sender.host
    req.message.contact.address.uri.port = req.sender.port
    req.message.contact.address.uri.transportParam = req.sender.transport
  }

  return req
}

// Will do the best effort to normalize from/to/requestUri users as e164 values.
// Connect applies it per Trunk (spec.normalizeToE164), on the way in before routing
// and on the way out through the tailor.
//
// The phone library validates mobile prefixes by default, which rejects
// landlines; that check is off everywhere, so any valid number is normalized.
// (The first version did the same; a later port turned it on for From alone.)
const normalize = (user: string | undefined) =>
  phone(`+${user}`, { validateMobilePrefix: false })

export const normalizeToE164 =
  (normalizeToE164: boolean) =>
  (request: MessageRequest): MessageRequest => {
    if (!normalizeToE164) return request

    const req = H.deepCopy(request)

    // Removes the + to ensure not having duplicates
    const fromUser = req.message.from.address.uri.user?.replace("+", "")
    const toUser = req.message.to.address.uri.user?.replace("+", "")
    const requestUriUser = req.message.requestUri.user?.replace("+", "")

    // Normalizing as e164
    const normalizedTo = normalize(toUser)
    const normalizedFrom = normalize(fromUser)
    const normalizedReqUri = normalize(requestUriUser)

    // If the normalization worked we overwrite the original values
    if (normalizedFrom.isValid) {
      req.message.from.address.uri.user = normalizedFrom.phoneNumber
    }

    if (normalizedTo.isValid) {
      req.message.to.address.uri.user = normalizedTo.phoneNumber
    }

    if (normalizedReqUri.isValid) {
      req.message.requestUri.user = normalizedReqUri.phoneNumber
    }

    return req
  }

/**
 * Whether a From is the anonymous identity (RFC 3323, SIP Connect 1.1 section 9).
 * A caller that asked for privacy keeps it, so such a From is never rewritten.
 *
 * @param {CommonTypes.SipURI} uri - the From URI
 * @return {boolean} true for anonymous@anonymous.invalid and its variants
 */
export const isAnonymous = (uri: CommonTypes.SipURI): boolean =>
  uri.user?.toLowerCase() === CommonTypes.ANONYMOUS ||
  uri.host?.toLowerCase() === "anonymous.invalid"

/**
 * Presents the Number as the caller toward a Trunk with rewriteFromWithNumber.
 * Carriers that authenticate by the From header (WhatsApp Business Calling, many
 * SIPconnect carriers) only accept a From that is the business number at their
 * domain. The tag and display name stay, so the dialog is unchanged for Routr,
 * which matches on tags and Call-ID. An anonymous From is left as it is.
 *
 * To moves to the Trunk URI's host and port, so it matches the Request-URI
 * (RFC 3261 section 8.1.1.1): WhatsApp Business Calling answers 403 when the
 * digest uri, the Request-URI, differs from To. Its user stays as
 * normalizeToE164 left it, and an anonymous From doesn't change that.
 *
 * @param {Route} route - the route; does nothing unless route.rewriteFrom is set
 * @return {Function} the alteration
 */
export const rewriteFromWithNumber =
  (route: Route) =>
  (request: MessageRequest): MessageRequest => {
    if (!route.rewriteFrom) return request

    const req = H.deepCopy(request)
    const to = req.message.to.address.uri
    to.host = route.host
    to.port = route.port

    if (isAnonymous(req.message.from.address.uri)) return req

    const uri = req.message.from.address.uri
    uri.user = route.rewriteFrom.user
    uri.host = route.rewriteFrom.host
    // The URI names a telephone number (RFC 3261 section 19.1.1), as the
    // P-Asserted-Identity Connect adds toward the Trunk does
    uri.userParam = "phone"
    // The caller's own port has no meaning at the carrier's domain; -1 is how
    // the EdgePort's converter spells "no port"
    uri.port = -1
    return req
  }

const sameIdentity = (uri: CommonTypes.SipURI, identity?: Identity) =>
  !!identity &&
  (uri.user ?? "") === (identity.user ?? "") &&
  uri.host?.toLowerCase() === identity.host.toLowerCase()

const changed = (a: CommonTypes.SipURI, b: CommonTypes.SipURI) =>
  (a.user ?? "") !== (b.user ?? "") ||
  a.host !== b.host ||
  portOf(a) !== portOf(b) ||
  (a.userParam ?? "") !== (b.userParam ?? "")

/**
 * The identity mapping that remembers how the identity alterations changed a
 * request's From and To; addSelfRecordRoute writes it in its Record-Route URI. Both ends of the dialog copy Record-Route into the
 * Route of their in-dialog requests, so the mapping comes back to Routr on every
 * BYE, re-INVITE and ACK without any state in Routr (see swapIdentityFromRouteSet).
 *
 * @param {MessageRequest} original - the request before the identity alterations
 * @param {MessageRequest} altered - the request after them
 * @return {Record<string, string>} the parameters, empty when nothing changed
 */
export const identityRewriteParameters = (
  original: MessageRequest,
  altered: MessageRequest
): Record<string, string> => {
  const parameters: Record<string, string> = {}
  const fromBefore = original.message.from.address.uri
  const fromAfter = altered.message.from.address.uri
  const toBefore = original.message.to.address.uri
  const toAfter = altered.message.to.address.uri

  if (changed(fromBefore, fromAfter)) {
    parameters[IDENTITY_PARAMETERS.fromOriginal] = encodeIdentity(fromBefore)
    parameters[IDENTITY_PARAMETERS.fromNew] = encodeIdentity(fromAfter)
  }

  if (changed(toBefore, toAfter)) {
    parameters[IDENTITY_PARAMETERS.toOriginal] = encodeIdentity(toBefore)
    parameters[IDENTITY_PARAMETERS.toNew] = encodeIdentity(toAfter)
  }

  return parameters
}

// Like isSelfRoute, but a Route on a transport this EdgePort lacks is simply
// not ours, instead of an error that would stop the in-dialog request
const isOwnRoute = (
  request: MessageRequest,
  route: CommonTypes.RouteHeader
): boolean => {
  try {
    return isSelfRoute(request)(route)
  } catch {
    return false
  }
}

// The mapping a Route entry carries: in its URI user part, which a user agent
// keeps (RFC 3261 section 12.1.2), else in its header parameters, which it may
// drop. Only the user part carries the port, so only it is applied exactly.
const identityMapping = (
  route: CommonTypes.RouteHeader
): { values: Record<string, string>; exact: boolean } | undefined => {
  const hasMapping = (values?: Record<string, string>) =>
    !!values?.[IDENTITY_PARAMETERS.fromNew] ||
    !!values?.[IDENTITY_PARAMETERS.toNew]
  const inUser = decodeIdentityUser(route.address?.uri?.user)
  if (hasMapping(inUser)) return { values: inUser, exact: true }
  if (hasMapping(route.parameters)) {
    return { values: route.parameters, exact: false }
  }
  return undefined
}

const applyIdentity = (
  uri: CommonTypes.SipURI,
  identity: Identity,
  exact: boolean
) => {
  uri.user = identity.user
  uri.host = identity.host
  uri.userParam = identity.userParam
  if (exact) uri.port = identity.port ?? -1
}

/**
 * Keeps each side of a dialog seeing the identities it knows. A request from the
 * caller gets the From and To the Trunk saw on the INVITE; a request from the
 * Trunk, whose To is the Number, gets the caller's own identity back. Some phones
 * answer 481 to an in-dialog request whose To or From URI changed.
 *
 * The mapping is read from the first Route entry that carries one, in its URI
 * user part or else its header parameters, and only when that entry points at
 * this EdgePort: with two EdgePorts on the path, the one that rewrote the INVITE
 * is the one that swaps, and the other leaves the request alone.
 *
 * @param {MessageRequest} request - an in-dialog request, with its Route set
 * @return {MessageRequest} the request with From and To swapped where they match
 */
export const swapIdentityFromRouteSet = (
  request: MessageRequest
): MessageRequest => {
  const own = (request.message.route ?? []).find((r: CommonTypes.RouteHeader) =>
    identityMapping(r)
  )

  if (!own || !isOwnRoute(request, own)) return request

  const { values, exact } = identityMapping(own)
  const fromOriginal = decodeIdentity(values[IDENTITY_PARAMETERS.fromOriginal])
  const fromNew = decodeIdentity(values[IDENTITY_PARAMETERS.fromNew])
  const toOriginal = decodeIdentity(values[IDENTITY_PARAMETERS.toOriginal])
  const toNew = decodeIdentity(values[IDENTITY_PARAMETERS.toNew])

  const req = H.deepCopy(request)
  const from = req.message.from.address.uri
  const to = req.message.to.address.uri

  // From the caller: From is the caller, To is the callee
  if (fromNew && sameIdentity(from, fromOriginal)) {
    applyIdentity(from, fromNew, exact)
  } else if (toOriginal && sameIdentity(from, toNew)) {
    // From the Trunk: From is the callee as the Trunk knows it
    applyIdentity(from, toOriginal, exact)
  }

  if (toNew && sameIdentity(to, toOriginal)) {
    applyIdentity(to, toNew, exact)
  } else if (fromOriginal && sameIdentity(to, fromNew)) {
    // From the Trunk: To is the Number the caller was presented as
    applyIdentity(to, fromOriginal, exact)
  }

  return req
}

// Dialogs that cross EdgePorts. The alterations below are Connect's own
// (internal/connect/alterations.go), for a processor that forwards a request
// to the peer EdgePort holding the endpoint's connection when the EdgePorts
// share one external address (behind a load balancer): addRouteToPeerEdgePort
// and addSelfRecordRoute name that shared address, so the request, or the
// dialog's later ones, can land on an EdgePort that doesn't hold the
// connection. These name each EdgePort by its own localnet address where it
// faces the other. The functions above are unchanged.
//
// fromPeer and peerSource are what the processor's own trust check decides:
// set them only for a request whose sourceAddress is a peer EdgePort the
// processor trusts. The SDK doesn't decide who is a peer.

const IPV4_BITS = 32
const IPV6_BITS = 128

// The bits of an IP address, most significant first; undefined when it is
// not one.
const addressBits = (address: string): number[] | undefined => {
  if (isIPv4(address)) {
    return address
      .split(".")
      .flatMap((octet) =>
        Array.from({ length: 8 }, (_, i) => (Number(octet) >> (7 - i)) & 1)
      )
  }
  if (!isIPv6(address)) return undefined
  const [head, tail] = address.includes("::")
    ? address.split("::")
    : [address, undefined]
  const headGroups = head ? head.split(":") : []
  const tailGroups = tail ? tail.split(":") : []
  const groups =
    tail === undefined
      ? headGroups
      : [
          ...headGroups,
          ...Array(8 - headGroups.length - tailGroups.length).fill("0"),
          ...tailGroups
        ]
  return groups.flatMap((group) =>
    Array.from({ length: 16 }, (_, i) => (parseInt(group, 16) >> (15 - i)) & 1)
  )
}

// The prefix length of a localnet: a CIDR, a dotted IPv4 mask, or none (a
// single address); undefined when it doesn't parse.
const prefixOf = (address: string, mask?: string): number | undefined => {
  const bits = isIPv4(address) ? IPV4_BITS : IPV6_BITS
  if (mask === undefined) return bits
  if (isIPv4(mask)) {
    return (addressBits(mask) ?? []).filter((bit) => bit === 1).length
  }
  const n = Number(mask)
  return Number.isInteger(n) && n >= 0 && n <= bits ? n : undefined
}

// The address part of a localnet, the EdgePort's address on it; undefined
// when the localnet is written as a network address (host bits zero with a
// shorter prefix than the address, such as 10.244.0.0/16), which names no
// interface and would be the same on every EdgePort.
const localnetHost = (network: string): string | undefined => {
  const [address, mask] = network.split("/")
  const bits = addressBits(address)
  const prefix = bits ? prefixOf(address, mask) : undefined
  if (!bits || prefix === undefined) return undefined
  const hostBits = bits.slice(prefix)
  if (hostBits.length > 0 && hostBits.every((bit) => bit === 0)) {
    return undefined
  }
  return address
}

const hasIpSafe = (network: string, host: string): boolean => {
  try {
    return IpUtils.hasIp(network, host)
  } catch {
    return false
  }
}

// The EdgePort's address on the first localnet the host belongs to, passing
// over the network-form ones.
const localnetIp = (localnets: string[], host: string): string | undefined =>
  localnets
    ?.filter((network) => localnetHost(network) && hasIpSafe(network, host))
    .map(localnetHost)[0]

const isLoopback = (host: string): boolean =>
  (isIPv4(host) && host.startsWith("127.")) || host === "::1"

const findListeningPoint = (
  listeningPoints: NetInterface[],
  transport?: string
): NetInterface | undefined => {
  try {
    return H.getListeningPoint(listeningPoints, transport as Transport)
  } catch {
    return undefined
  }
}

const prependVia = (req: MessageRequest, intf: NetInterface) => {
  req.message.via = [{ ...intf, rPortFlag: true }, ...req.message.via]
}

const prependRoute = (
  req: MessageRequest,
  host: string,
  port: number,
  transport: Transport
) => {
  const r = {
    address: { uri: { host, port, transportParam: transport, lrParam: true } }
  } as CommonTypes.RouteHeader
  req.message.route = [r, ...req.message.route]
}

// Whether a Route entry looks like a peer EdgePort's own address: not this
// EdgePort, inside its localnets, on the port it listens on for that transport
const isPeerRoute = (
  request: MessageRequest,
  r: CommonTypes.RouteHeader
): boolean => {
  const uri = r.address.uri
  const lp = findListeningPoint(request.listeningPoints, uri.transportParam)
  if (!lp || lp.port !== uri.port || isSelfRoute(request)(r)) return false
  return localnetIp(request.localnets, uri.host) !== undefined
}

const addSelfViaUsingExternalAddrsFromPeer = (
  request: MessageRequest,
  fromPeer: boolean
): MessageRequest => {
  const req = H.deepCopy(request)
  const uri = request.message.requestUri
  // No transport means UDP. A peer EdgePort sends the Request-URI with no
  // parameters, so a request from one goes on the transport it came on; so
  // does one on an EdgePort without UDP
  const transport =
    !uri.transportParam &&
    (fromPeer || !findListeningPoint(request.listeningPoints, Transport.UDP))
      ? request.sender.transport
      : uri.transportParam
  prependVia(
    req,
    getEdgeInterface({
      ...request,
      endpointIntf: { host: uri.host, port: uri.port, transport }
    })
  )
  return req
}

/**
 * Adds this EdgePort's Via, with the rport flag, for an in-dialog request.
 * When the top Route is a peer EdgePort's own address (in one of this
 * EdgePort's localnets, on the port it listens on for the entry's transport,
 * and not this EdgePort), the Via faces that peer, on that transport.
 * Otherwise it faces the Request-URI as addSelfViaUsingExternalAddrs does,
 * except that a Request-URI with no transport goes on the transport the
 * request came on when fromPeer is set or this EdgePort doesn't listen on UDP.
 *
 * @param {boolean} fromPeer - the request came from a peer EdgePort the
 * processor trusts
 * @return {Function} the alteration; it throws getEdgeInterface's errors
 */
export const addSelfViaTowardNextHop =
  (fromPeer: boolean) =>
  (request: MessageRequest): MessageRequest => {
    const top = request.message.route?.[0]
    if (!top || !isPeerRoute(request, top)) {
      return addSelfViaUsingExternalAddrsFromPeer(request, fromPeer)
    }
    const req = H.deepCopy(request)
    prependVia(
      req,
      getEdgeInterface({
        ...request,
        endpointIntf: {
          host: top.address.uri.host,
          port: top.address.uri.port,
          transport: top.address.uri.transportParam
        }
      })
    )
    return req
  }

// The address of the peer EdgePort the route lives on, on the first of its
// localnets that is in one of this EdgePort's localnets
const peerOwnAddress = (
  request: MessageRequest,
  route: Route
): string | undefined =>
  (route.localnets ?? [])
    .map(localnetHost)
    .find(
      (host) =>
        host &&
        !isLoopback(host) &&
        localnetIp(request.localnets, host) !== undefined
    )

/**
 * Puts the peer EdgePort the route lives on on top of the route set, as a
 * loose route: at the peer's own address, on its listening port for the
 * route's transport, when the peer is on one of this EdgePort's localnets
 * (loopback and network-form localnets never count); else on its interface
 * facing the endpoint, as addRouteToPeerEdgePort does.
 *
 * @param {Route} route - the route on the peer EdgePort
 * @return {Function} the alteration; it throws getEdgeInterface's errors, or
 * NoListeningPointError for a transport the peer doesn't listen on
 */
export const addRouteToPeerEdgePortOwnAddress =
  (route: Route) =>
  (request: MessageRequest): MessageRequest => {
    const host = peerOwnAddress(request, route)
    if (!host) return addRouteToPeerEdgePort(route)(request)
    const lp = H.getListeningPoint(route.listeningPoints, route.transport)
    const req = H.deepCopy(request)
    prependRoute(req, host, lp.port, lp.transport)
    return req
  }

// Puts this EdgePort on top of the Record-Route set: the origin interface
// and, when the target interface differs, that one too, both marked r2=on
const recordRouteBetween = (
  req: MessageRequest,
  origin: NetInterface,
  target: NetInterface,
  parameters: Record<string, string>
) => {
  const user = encodeIdentityUser(parameters)
  const entry = (
    intf: NetInterface,
    params?: Record<string, string>
  ): CommonTypes.RecordRoute => ({
    address: {
      uri: {
        ...(user ? { user } : {}),
        host: intf.host,
        port: intf.port,
        transportParam: intf.transport,
        lrParam: true
      }
    },
    ...(params ? { parameters: params } : {})
  })
  const differs =
    origin.host !== target.host ||
    origin.port !== target.port ||
    origin.transport !== target.transport
  req.message.recordRoute = differs
    ? [
        entry(target, { r2: "on" }),
        entry(origin, { r2: "on" }),
        ...req.message.recordRoute
      ]
    : [entry(origin), ...req.message.recordRoute]
}

/**
 * addSelfRecordRoute for a request a trusted peer EdgePort forwarded:
 * peerSource is the address it came from (its sourceAddress, taken before any
 * Via is added), and the origin entry is the interface facing it instead of
 * the sender, whose host is the peer's interface facing the endpoint. An
 * empty peerSource gives addSelfRecordRoute's result.
 *
 * @param {Route} route - the route
 * @param {Record<string, string>} parameters - the identity mapping
 * @param {string} peerSource - the peer EdgePort's address, or ""
 * @return {Function} the alteration; it throws getEdgeInterface's errors
 */
export const addSelfRecordRouteFromPeer =
  (route: Route, parameters: Record<string, string> = {}, peerSource = "") =>
  (request: MessageRequest): MessageRequest => {
    const nets = {
      listeningPoints: request.listeningPoints,
      localnets: request.localnets,
      externalAddrs: request.externalAddrs
    }
    const origin = getEdgeInterface({
      ...nets,
      endpointIntf: {
        ...request.sender,
        host: peerSource || request.sender.host
      }
    })
    const target = getEdgeInterface({
      ...nets,
      endpointIntf: {
        host: route.advertisedHost,
        port: route.advertisedPort,
        transport: route.transport
      }
    })
    const req = H.deepCopy(request)
    recordRouteBetween(req, origin, target, parameters)
    return req
  }

// This EdgePort's address on the localnet the peer EdgePort the route lives
// on is in, on the listening point of the route's transport: the peer is
// looked for at the interface the request goes to and at its own localnet
// addresses
const peerFacingInterface = (
  request: MessageRequest,
  route: Route
): NetInterface | undefined => {
  const lp = findListeningPoint(request.listeningPoints, route.transport)
  if (!lp) return undefined
  const toward = (() => {
    try {
      return [
        getEdgeInterface({
          listeningPoints: route.listeningPoints,
          localnets: route.localnets,
          externalAddrs: route.externalAddrs,
          endpointIntf: route
        }).host
      ]
    } catch {
      return []
    }
  })()
  const ip = [...toward, ...(route.localnets ?? []).map(localnetHost)]
    .filter((host) => host && !isLoopback(host))
    .map((host) => localnetIp(request.localnets, host))
    .find((found) => found && !isLoopback(found))
  return ip ? { host: ip, port: lp.port, transport: lp.transport } : undefined
}

/**
 * addSelfRecordRoute for a request forwarded to the peer EdgePort the route
 * lives on: the target entry is this EdgePort's own localnet address facing
 * the peer, so the dialog's route set names both EdgePorts by their own
 * addresses (RFC 5658, double Record-Route). When the peer is in none of this
 * EdgePort's localnets, or this EdgePort doesn't listen on the route's
 * transport, it is addSelfRecordRoute.
 *
 * @param {Route} route - the route on the peer EdgePort
 * @param {Record<string, string>} parameters - the identity mapping
 * @return {Function} the alteration; it throws getEdgeInterface's errors
 */
export const addSelfRecordRouteToPeer =
  (route: Route, parameters: Record<string, string> = {}) =>
  (request: MessageRequest): MessageRequest => {
    const target = peerFacingInterface(request, route)
    if (!target) return addSelfRecordRouteFromPeer(route, parameters)(request)
    const origin = getEdgeInterface({
      listeningPoints: request.listeningPoints,
      localnets: request.localnets,
      externalAddrs: request.externalAddrs,
      endpointIntf: request.sender
    })
    const req = H.deepCopy(request)
    recordRouteBetween(req, origin, target, parameters)
    return req
  }

// Whether a Route entry points at this EdgePort by its own address, one of
// its localnet addresses, which no peer EdgePort has
const isOwnAddressRoute = (
  request: MessageRequest,
  r: CommonTypes.RouteHeader
): boolean =>
  request.localnets.some(
    (network) => localnetHost(network) === r.address.uri.host
  ) && isSelfRoute(request)(r)

/**
 * Consumes, in a dialog that crossed EdgePorts, every Route entry up to the
 * last one that names this EdgePort by its own address (a localnet address,
 * never a network-form localnet): the ones before it are this EdgePort's and
 * its peers' toward the sender, where the request has already been. Without
 * such an entry, the request is returned as it is. Run it before
 * removeSelfRoutes and addSelfViaTowardNextHop.
 *
 * @param {MessageRequest} request - an in-dialog request
 * @return {MessageRequest} the request without those entries
 */
export const removeRoutesUpToOwn = (
  request: MessageRequest
): MessageRequest => {
  const routes = request.message.route ?? []
  const last = routes
    .map((r: CommonTypes.RouteHeader) => isOwnAddressRoute(request, r))
    .lastIndexOf(true)
  if (last === -1) return request
  const req = H.deepCopy(request)
  req.message.route = routes.slice(last + 1)
  return req
}

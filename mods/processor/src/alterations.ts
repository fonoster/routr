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
  Identity as I
} from "@routr/common"
import { phone } from "phone"
import { getEdgeInterface } from "./helper"

const {
  IDENTITY_PARAMETERS,
  encodeIdentity,
  decodeIdentity,
  decodeIdentityUser
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

// The parameters argument is merged into every Record-Route entry this adds;
// identityRewriteParameters uses it to carry a rewritten From or To.
export const addSelfRecordRoute =
  (route: Route, parameters: Record<string, string> = {}) =>
  (request: MessageRequest): MessageRequest => {
    const req = H.deepCopy(request)
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
            host: targetIntf.host,
            port: targetIntf.port,
            transportParam: targetIntf.transport,
            lrParam: true
          }
        },
        parameters: {
          r2: "on",
          ...parameters
        }
      }

      // Add r2 on to origin route
      originRoute.parameters = {
        r2: "on",
        ...parameters
      }

      req.message.recordRoute = [
        targetRoute,
        originRoute,
        ...req.message.recordRoute
      ]
    } else {
      if (Object.keys(parameters).length > 0) {
        originRoute.parameters = { ...parameters }
      }
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
    const lp = H.getListeningPoint(
      request.listeningPoints,
      (r.address.uri.transportParam?.toUpperCase() as Transport) ||
        Transport.UDP
    )

    const routeUri = r.address.uri
    const aliases = (request.aliases || []).map((a) => a.toLowerCase())
    return (
      (localIps.includes(routeUri.host) ||
        request.externalAddrs.includes(routeUri.host) ||
        aliases.includes(routeUri.host?.toLowerCase())) &&
      routeUri.port === lp?.port
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
 * @param {Route} route - the route; does nothing unless route.rewriteFrom is set
 * @return {Function} the alteration
 */
export const rewriteFromWithNumber =
  (route: Route) =>
  (request: MessageRequest): MessageRequest => {
    if (!route.rewriteFrom) return request
    if (isAnonymous(request.message.from.address.uri)) return request

    const req = H.deepCopy(request)
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
  (a.userParam ?? "") !== (b.userParam ?? "")

/**
 * The Record-Route parameters that remember how the identity alterations changed
 * a request's From and To. Both ends of the dialog copy Record-Route into the
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

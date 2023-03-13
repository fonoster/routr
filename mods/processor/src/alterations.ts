/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
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
  Transport
} from "@routr/common"
import { phone } from "phone"
import { getEdgeInterface } from "./helper"

// Q: Should we deprecate this method since we are not doing strict routing?
export const updateRequestURI =
  (route: Route) =>
  (request: MessageRequest): MessageRequest => {
    const req = H.deepCopy(request)
    if (route.user) {
      req.message.requestUri.user = route.user
    } else {
      req.message.requestUri.user = null
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
    if (route.headers && route.headers.length > 0) {
      const headersToRemove = route.headers
        .filter(
          (h: HeaderModifier) =>
            h.action === CommonTypes.HeaderModifierAction.REMOVE
        )
        .map((h) => h.name.toLowerCase())

      const headersToAdd = route.headers.filter(
        (h: HeaderModifier) => h.action === CommonTypes.HeaderModifierAction.ADD
      )

      req.message.extensions = req.message.extensions.filter(
        (h: CommonTypes.Extension) =>
          !headersToRemove.includes(h.name.toLowerCase())
      )

      headersToAdd.forEach((h: HeaderModifier) => {
        req.message.extensions.push({ name: h.name, value: h.value })
      })
    }
    return req
  }

export const addSelfRecordRoute =
  (route: Route) =>
  (request: MessageRequest): MessageRequest => {
    const req = H.deepCopy(request)
    const originIntf = getEdgeInterface({
      listeningPoints: request.listeningPoints,
      localnets: request.localnets,
      externalAddrs: request.externalAddrs,
      endpointIntf: request.sender
    })
    const targetIntf = getEdgeInterface({
      listeningPoints: request.listeningPoints,
      localnets: request.localnets,
      externalAddrs: request.externalAddrs,
      endpointIntf: route
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
      ext.name.toLowerCase() !== CommonTypes.ExtraHeader.EDGEPORT_REF
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

export const removeSelfRoutes = (request: MessageRequest): MessageRequest => {
  const req = H.deepCopy(request)
  const localIps = request.localnets.map((ln) => ln.split("/")[0])

  req.message.route = req.message.route.filter((r: CommonTypes.RouteHeader) => {
    const lp = H.getListeningPoint(
      request.listeningPoints,
      (r.address.uri.transportParam?.toUpperCase() as Transport) ||
        Transport.UDP
    )

    const routeUri = r.address.uri
    return !(
      (localIps.includes(routeUri.host) ||
        request.externalAddrs.includes(routeUri.host)) &&
      routeUri.port === lp.port
    )
  })
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

// Will do the best effort to normalize from/to/requestUri users as e164 values
export const enforceE164 =
  (enforceE164: boolean, validateMobilePrefix: boolean) =>
  (request: MessageRequest): MessageRequest => {
    if (!enforceE164) return request

    const req = H.deepCopy(request)

    // Removes the + to ensure not having duplicates
    const fromUser = req.message.from.address.uri.user?.replace("+", "")
    const toUser = req.message.to.address.uri.user?.replace("+", "")
    const requestUriUser = req.message.requestUri.user?.replace("+", "")

    // Normalizing as e164
    const normalizedTo = phone(`+${toUser}`, { validateMobilePrefix })
    const normalizedFrom = phone(`+${fromUser}`, {
      validateMobilePrefix: true
    })
    const normalizedReqUri = phone(`+${requestUriUser}`, {
      validateMobilePrefix
    })

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

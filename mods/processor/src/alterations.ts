/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
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
  IpUtils as I,
  MessageRequest,
  Route,
  CommonTypes,
  Helper,
  Transport
} from "@routr/common"
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
    // If is comming from a different edgeport we use the listening point instead
    // of the endpoint to ensure connectivity.
    const nextHopHost =
      request.edgePortRef === route.edgePortRef
        ? route.host
        : route.egressListeningPoint.host

    const egressListeningPoint = Helper.getListeningPoint(
      request,
      route.transport
    )

    // If the nextHopHost host is local, then use use lp to construct via
    // otherwise, we use the first available external ip.
    const via = I.isLocalnet(req.localnets, nextHopHost)
      ? route.egressListeningPoint
      : {
          // fallback to lp host if there is no external ips
          host: req.externalAddrs[0] ?? egressListeningPoint.host,
          port: egressListeningPoint.port,
          transport: egressListeningPoint.transport
        }

    req.message.via = [via, ...req.message.via]

    return req
  }

export const addRoute =
  (route: Route) =>
  (request: MessageRequest): MessageRequest => {
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

export const addRouteToListeningPoint =
  (route: Route) =>
  (request: MessageRequest): MessageRequest => {
    const req = H.deepCopy(request)
    const r = {
      address: {
        uri: {
          host: route.egressListeningPoint.host,
          port: route.egressListeningPoint.port,
          transportParam: route.egressListeningPoint.transport,
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
        .map((h) => h.name)

      const headersToAdd = route.headers.filter(
        (h: HeaderModifier) =>
          h.action !== CommonTypes.HeaderModifierAction.REMOVE
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
    const originIntf = getEdgeInterface(request, request.sender)
    const targetIntf = getEdgeInterface(request, route)

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

export const removeRoutes = (request: MessageRequest): MessageRequest => {
  const req = H.deepCopy(request)
  req.message.route = req.message.route.filter((r: CommonTypes.RouteHeader) => {
    const localIps = request.localnets.map((ln) => ln.split("/")[0])
    const lp = Helper.getListeningPoint(
      request,
      (r.address.uri.transportParam?.toLowerCase() as Transport) ||
        Transport.UDP
    )

    const route = r.address.uri
    return !(
      (localIps.includes(route.host) ||
        request.externalAddrs.includes(route.host)) &&
      route.port === lp.port
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

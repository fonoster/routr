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
  CommonTypes
} from "@routr/common"

export const updateRequestURI = (route: Route) => {
  return (request: MessageRequest): MessageRequest => {
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
}

export const addSelfVia = (route: Route) => {
  return (request: MessageRequest): MessageRequest => {
    const req = H.deepCopy(request)
    // If is comming from a different edgeport we use the listening point instead
    // of the endpoint to ensure connectivity.
    const nextHopHost =
      request.edgePortRef === route.edgePortRef
        ? route.host
        : route.listeningPoint.host

    // If the nextHopHost host is local, then use use lp to construct via
    // otherwise, we use the first external ip available.
    const via = I.isLocalnet(req.localnets, nextHopHost)
      ? route.listeningPoint
      : {
          // fallback to lp host if there is no external ips
          host: req.externalIps[0] || req.listeningPoint.host,
          port: req.listeningPoint.port,
          transport: req.listeningPoint.transport
        }

    req.message.via = [via, ...req.message.via]

    return req
  }
}

export const addRoute = (route: Route) => {
  return (request: MessageRequest): MessageRequest => {
    const req = H.deepCopy(request)
    const lp = route.listeningPoint
    const r = {
      address: {
        uri: {
          host: lp.host,
          port: lp.port,
          transportParam: lp.transport,
          lrParam: true
        }
      }
    } as CommonTypes.RecordRoute
    req.message.route = [r, ...req.message.recordRoute]
    return req
  }
}

export const applyXHeaders = (route: Route) => {
  return (request: MessageRequest): MessageRequest => {
    const req = H.deepCopy(request)
    if (route.headers && route.headers.length > 0) {
      const headersToRemove = route.headers
        .filter((h: HeaderModifier) => h.action === "remove")
        .map((h) => h.name)
      const headersToAdd = route.headers.filter(
        (h: HeaderModifier) => h.action !== "remove"
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
}

export const addSelfRecordRoute = (request: MessageRequest): MessageRequest => {
  const req = H.deepCopy(request)
  const lp = req.listeningPoint
  const r = {
    address: {
      uri: {
        host: lp.host,
        port: lp.port,
        transportParam: lp.transport,
        lrParam: true
      }
    }
  } as CommonTypes.RouteHeader
  req.message.recordRoute = [r, ...req.message.recordRoute]
  return req
}

export const addXEdgePortRef = (request: MessageRequest): MessageRequest => {
  const req = H.deepCopy(request)
  const r = {
    name: "X-EdgePort-Ref",
    value: request.edgePortRef
  }
  req.message.extensions = [r, ...req.message.extensions]
  return req
}

export const removeXEdgePortRef = (request: MessageRequest): MessageRequest => {
  const req = H.deepCopy(request)
  req.message.extensions = req.message.extensions.filter(
    (ext: CommonTypes.Extension) => ext.name.toLowerCase() !== "x-edgeport-ref"
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
    const lp = request.listeningPoint
    const route = r.address.uri
    return !(
      (route.host === lp.host || request.externalIps.includes(route.host)) &&
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

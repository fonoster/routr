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
import { MessageRequest, Route, Helper as H, IpUtils as I } from "@routr/common";
import { getHeaderValue, updateHeader } from "./extensions";

export const updateRequestURI = (route: Route) => {
  return (request: MessageRequest): MessageRequest => {
    const req = H.deepCopy(request) as any
    if (route.user) {
      req.message.requestUri.user = route.user
    } else {
      req.message.requestUri.user = null
    }
    req.message.requestUri.host = route.host
    req.message.requestUri.port = route.port
    req.message.requestUri.transport = route.transport
    return req
  }
}

export const addSelfVia = (route: Route) => {
  return (request: MessageRequest): MessageRequest => {
    const req = H.deepCopy(request) as any
    // If is comming from a different edgeport we use the listening point instead
    // of the endpoint to ensure connectivity.
    const nextHopHost = request.edgePortRef === route.edgePortRef
      ? route.host : route.listeningPoint.host

    // If the nextHopHost host is local, then use use lp to construct via
    // otherwise, we use the first external ip available.
    const via = I.isLocalnet(req.localnets, nextHopHost)
      ? req.listeningPoint
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

export const addSelfRecordRoute = (route: Route) => {
  return (request: MessageRequest): MessageRequest => {
    const req = H.deepCopy(request)
    const lp = req.listeningPoint
    const r = {
      name: "Record-Route",
      value: `<sip:${lp.host}:${lp.port};lr;transport=${lp.transport}>`
    }
    req.message.extensions = [r, ...req.message.extensions as any]
    return req
  }
}

export const addRoute = (route: Route) => {
  return (request: MessageRequest): MessageRequest => {
    const req = H.deepCopy(request)
    const lp = route.listeningPoint
    const r = {
      name: "Route",
      value: `<sip:${lp.host}:${lp.port};lr;transport=${lp.transport}>`
    }
    req.message.extensions = [r, ...req.message.extensions as any]
    return req
  }
}

export const addXEdgePortRef = (request: MessageRequest): MessageRequest => {
  const req = H.deepCopy(request)
  const r = {
    name: "X-EdgePort-Ref",
    value: request.edgePortRef
  }
  req.message.extensions = [r, ...req.message.extensions as any]
  return req
}

export const removeXEdgePortRef = (request: MessageRequest): MessageRequest => {
  const req = H.deepCopy(request)
  req.message.extensions = (req.message.extensions as any).filter((ext: any) =>
    ext.name.toLowerCase() !== "x-edgeport-ref")
  return req
}

export const removeAuthorization = (request: MessageRequest): MessageRequest => {
  const req = H.deepCopy(request)
  delete req.message.authorization 
  return req
}

// TODO: Remove only route headers that are not controlled by this edgeport
export const removeRoutes = (request: MessageRequest): MessageRequest => {
  const req = H.deepCopy(request)
  req.message.extensions = (req.message.extensions as any).filter((ext: any) =>
    ext.name.toLowerCase() !== "route")
  return req
}

export const removeTopVia = (request: MessageRequest): MessageRequest => {
  const req = H.deepCopy(request) as any
  req.message.via.shift()
  return req
}

export const decreaseMaxForwards = (request: MessageRequest) => {
  const req = H.deepCopy(request) as any
  if (req.message.maxForwards) {
    req.message.maxForwards.maxForwards = (req.message.maxForwards.maxForwards - 1)
  }
  return req
}

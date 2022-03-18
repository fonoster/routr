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
import { MessageRequest, Route, Helper as H } from "@routr/common";
import { getHeaderValue, updateHeader } from "./extensions";

export const updateRequestURI = (route: Route) => {
  return (request: MessageRequest) => {
    const req = H.deepCopy(request) as any
    if (route.user) {
      req.message.request_uri.user = route.user
    } else {
      req.message.request_uri.user = null
    }
    req.message.request_uri.host = route.host
    req.message.request_uri.port = route.port
    req.message.request_uri.transport = route.transport
    return req
  }
}

export const addSelfVia = (request: MessageRequest): MessageRequest => {
  /*message.via = [...message.via, {
    host: "192.168.1.3",
    port: 5060,
    transport: 'udp'
  }]*/
  return null
}

export const removeTopVia = (request: MessageRequest): MessageRequest => {
  const req = H.deepCopy(request) as any
  req.message.via.shift()
  return req
}

export const decreaseMaxForwards = (request: MessageRequest) => updateHeader(request, {
  name: 'Max-Forwards',
  value: (parseInt(getHeaderValue(request, 'Max-Forwards')) - 1) + ''
})

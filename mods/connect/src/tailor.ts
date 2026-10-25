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
import { Alterations as A, MessageRequest } from "@routr/processor"
import { Route } from "@routr/common"
import { pipe } from "fp-ts/function"

/**
 * The caller identity a Trunk asks for (Route.enforceE164 and Route.rewriteFrom),
 * applied to a request on its way out, plus the Record-Route parameters that let
 * Routr map the identities back on the dialog's later requests.
 *
 * @param {Route} route - the route; a Trunk route carries the settings
 * @param {MessageRequest} req - the request as routed
 * @return {object} the altered request and the Record-Route parameters
 */
export const applyTrunkIdentity = (
  route: Route,
  req: MessageRequest
): { req: MessageRequest; recordRouteParameters: Record<string, string> } => {
  const altered = pipe(
    req,
    A.enforceE164(!!route.enforceE164, false),
    A.rewriteFromWithNumber(route)
  )
  return {
    req: altered,
    recordRouteParameters: A.identityRewriteParameters(req, altered)
  }
}

// Q: Should we add support for strict routing?
export const tailor = (
  route: Route,
  request: MessageRequest
): MessageRequest => {
  const { req, recordRouteParameters } = applyTrunkIdentity(route, request)
  return pipe(
    req,
    A.decreaseMaxForwards,
    A.removeAuthorization,
    A.removeSelfRoutes,
    A.removeXEdgePortRef,
    // NOTE: We should consider making the overwriteContactWithSenderInfo an Agent/Peer level alteration
    // A.overwriteContactWithSenderInfo,
    A.fixInvalidContact,
    A.fixRequestURI(route),
    A.addSelfVia(route),
    A.applyXHeaders(route),
    A.addSelfRecordRoute(route, recordRouteParameters),
    A.addRouteToNextHop(route)
  )
}

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
import { Alterations as A, MessageRequest } from "@routr/processor"
import { Route } from "@routr/common"
import { pipe } from "fp-ts/function"

// Q: Should we add support for strict routing?
// TODO: Add updateContact for SIP.js support
export const tailor = (route: Route, req: MessageRequest): MessageRequest =>
  pipe(
    req,
    A.decreaseMaxForwards,
    A.removeAuthorization,
    A.removeSelfRoutes,
    A.removeXEdgePortRef,
    A.fixNatedContact,
    A.addSelfVia(route),
    A.applyXHeaders(route),
    A.addSelfRecordRoute(route),
    A.addRouteToNextHop(route)
  )

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
import { MessageRequest } from "@routr/common"
import { CommonTypes as CT } from "@routr/common"

export const getAOR = (uri: CT.SipURI) =>
  `${uri.secure ? "sips" : "sip"}:${uri.user ? uri.user + "@" : ""}${uri.host}`

export const getTargetAOR = (request: MessageRequest) =>
  getAOR(request.message.to.address.uri)

// Used when a REGISTER carries neither a Contact expires parameter nor an
// Expires header (RFC 3261 section 10.3, step 7)
export const DEFAULT_EXPIRES = 3600

export const getTargetExpires = (
  request: MessageRequest,
  defaultExpires: number = DEFAULT_EXPIRES
) => {
  // The expires value in the Contact header takes presendence over the value
  // on the Expires header
  const expires: number = request.message?.contact?.expires ?? -1
  if (expires > -1) return expires
  const headerExpires =
    (request.message.expires as { expires: number })?.expires ?? -1
  return headerExpires > -1 ? headerExpires : defaultExpires
}

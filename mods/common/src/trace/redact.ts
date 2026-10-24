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
import { MessageRequest, SIPMessage } from "../types"

export const REDACTED = "REDACTED"

// Header names whose value is a credential or a hash of one
const SECRET_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "x-gateway-auth"
])

/**
 * Returns a deep copy of the message with credentials replaced by REDACTED.
 * The digest `response` is the hash of the password and the only secret in a
 * SIP Digest exchange; nonce, realm and username stay so the exchange remains
 * readable.
 *
 * @param {SIPMessage} message - Message to copy
 * @return {SIPMessage} A redacted copy
 */
export function redactMessage(message: SIPMessage): SIPMessage {
  const copy = JSON.parse(JSON.stringify(message)) as SIPMessage

  if (copy.authorization) {
    copy.authorization.response = REDACTED
    if (copy.authorization.cNonce) copy.authorization.cNonce = REDACTED
  }

  copy.extensions = (copy.extensions || []).map((ext) =>
    SECRET_HEADERS.has(ext.name.toLowerCase())
      ? { ...ext, value: REDACTED }
      : ext
  )
  ;[copy.from?.address, copy.to?.address, copy.contact?.address]
    .concat((copy.route || []).map((r) => r.address))
    .concat((copy.recordRoute || []).map((r) => r.address))
    .forEach((address) => {
      if (address?.uri?.userPassword) address.uri.userPassword = REDACTED
    })

  if (copy.requestUri?.userPassword) copy.requestUri.userPassword = REDACTED

  return copy
}

/**
 * Returns a deep copy of the request with its message redacted.
 *
 * @param {MessageRequest} request - Request to copy
 * @return {MessageRequest} A redacted copy
 */
export function redactRequest(request: MessageRequest): MessageRequest {
  return {
    ...JSON.parse(JSON.stringify({ ...request, message: undefined })),
    message: redactMessage(request.message)
  }
}

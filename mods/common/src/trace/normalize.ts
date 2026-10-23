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
import { SIPMessage } from "../types"

/**
 * Returns a copy of the message with the values that legitimately differ
 * between two runs of the same scenario blanked: Via branches, From and To
 * tags, and the nonces of a digest exchange. Everything else a component
 * produces is deterministic for the same input and configuration.
 *
 * @param {SIPMessage} message - A message as recorded or as returned live
 * @return {SIPMessage} A copy safe to diff against another run
 */
export function normalizeMessage(message: SIPMessage): SIPMessage {
  const copy = JSON.parse(JSON.stringify(message)) as SIPMessage
  ;(copy.via || []).forEach((v) => {
    if (v.branch) v.branch = "*"
  })
  if (copy.from?.tag) copy.from.tag = "*"
  if (copy.to?.tag) copy.to.tag = "*"
  if (copy.wwwAuthenticate) {
    if (copy.wwwAuthenticate.nonce) copy.wwwAuthenticate.nonce = "*"
    if (copy.wwwAuthenticate.opaque) copy.wwwAuthenticate.opaque = "*"
  }
  if (copy.authorization) {
    if (copy.authorization.nonce) copy.authorization.nonce = "*"
    if (copy.authorization.cNonce) copy.authorization.cNonce = "*"
    if (copy.authorization.response) copy.authorization.response = "*"
  }
  return copy
}

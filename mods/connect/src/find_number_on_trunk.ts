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
import { getLogger } from "@fonoster/logger"
import {
  CommonConnect as CC,
  CommonResponse as CR,
  MessageRequest
} from "@routr/common"
import { checkTrunkAccess } from "./access"
import { matchTrunkNumber } from "./match_trunk_number"
import { NumberMatch } from "./types"
import { findNumberByTelUrl, recordingMetadata } from "./utils"

// Exported so a test can watch the ambiguity warning
export const logger = getLogger({ service: "connect", filePath: __filename })

/**
 * Finds the callee of a call that arrived on a Trunk without a Connect Token:
 * the Trunk alone decides it. The Trunk's access control list and inbound
 * credentials are checked first, so a source that may not use the Trunk
 * learns nothing about its Numbers. Then the Request-URI user, up to its
 * first ";", is looked up as a telUrl, as received and then as the Trunk's
 * normalizeToE164 left it; it counts only for a Number of this Trunk. Else
 * the Trunk's own Numbers are read once and matched (see matchTrunkNumber).
 *
 * @param {CC.APIClient} apiClient - API client
 * @param {MessageRequest} request - the INVITE, after normalizeToE164
 * @param {CC.Trunk} trunk - the Trunk whose inboundUri is the Request-URI host
 * @param {string} user - the Request-URI user as received, before normalizeToE164
 * @return {Promise<object>} the Number and how it matched, or the response to send:
 * 401 from the access check, 404 when no Number of the Trunk matches or two do
 */
export const findNumberOnTrunk = async (
  apiClient: CC.APIClient,
  request: MessageRequest,
  trunk: CC.Trunk,
  user: string
): Promise<
  | { number: CC.INumber; match: NumberMatch }
  | { response: Record<string, unknown> }
> => {
  const failedCheck = await checkTrunkAccess(request, trunk)

  if (failedCheck) return { response: failedCheck }

  const notFound = {
    response: CR.createNotFoundResponse(
      `No Number found for ${user}`,
      recordingMetadata(trunk)
    )
  }
  const received = (user ?? "").split(";")[0]
  const normalized = (request.message.requestUri.user ?? "").split(";")[0]

  if (!received) return notFound

  const exact = await [received, normalized]
    .filter((one, index, all) => one && all.indexOf(one) === index)
    .reduce<Promise<CC.INumber | undefined>>(async (found, identifier) => {
      const previous = await found
      if (previous) return previous
      const number = await findNumberByTelUrl(apiClient, `tel:${identifier}`)
      return number?.trunk?.ref === trunk.ref ? number : undefined
    }, Promise.resolve(undefined))

  if (exact) return { number: exact, match: NumberMatch.EXACT }

  const { items: numbers } = await apiClient.numbers.findBy({
    fieldName: "trunkRef",
    fieldValue: trunk.ref
  })

  const found = matchTrunkNumber(user, numbers)

  if (!found) return notFound

  if ("ambiguous" in found) {
    logger.warn("the called number matches more than one Number of the Trunk", {
      ref: request.ref,
      trunk: trunk.ref,
      user,
      numbers: found.ambiguous.map((number) => number.ref).join(",")
    })
    return notFound
  }

  return found
}

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
import {
  CommonConnect as CC,
  CommonResponse as CR,
  MessageRequest
} from "@routr/common"
import { checkTrunkAccess } from "./access"
import { matchTrunkNumber } from "./match_trunk_number"
import { NumberMatch } from "./types"
import { recordingMetadata } from "./utils"

/**
 * Finds the Number of a call that arrived on a Trunk with a Request-URI user
 * no Number answers to exactly. The Trunk's access control list and inbound
 * credentials are checked first, so a source that may not use the Trunk never
 * learns which users match. Then the Trunk's own Numbers are read once and
 * matched (see matchTrunkNumber).
 *
 * @param {CC.APIClient} apiClient - API client
 * @param {MessageRequest} request - the INVITE
 * @param {CC.Trunk} trunk - the Trunk whose inboundUri is the Request-URI host
 * @param {string} user - the Request-URI user as received, before normalizeToE164
 * @return {Promise<object>} the Number and how it matched, or the response to send:
 * 401 from the access check, 404 when no Number matches
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

  const numbers = (
    await apiClient.numbers.findBy({
      fieldName: "trunkRef",
      fieldValue: trunk.ref
    })
  ).items

  const found = matchTrunkNumber(user, numbers)

  if (found) return found

  return {
    response: CR.createNotFoundResponse(
      `No Number found for ${user}`,
      recordingMetadata(trunk)
    )
  }
}

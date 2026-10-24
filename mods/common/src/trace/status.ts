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
import { ResponseType } from "../types"

// RFC 3261 §21 status codes for every ResponseType the proto can carry
const STATUS_CODES: Record<string, number> = {
  [ResponseType.TRYING]: 100,
  [ResponseType.RINGING]: 180,
  [ResponseType.CALL_IS_BEING_FORWARDED]: 181,
  [ResponseType.QUEUED]: 182,
  [ResponseType.SESSION_PROGRESS]: 183,
  [ResponseType.SUCCESS]: 200,
  [ResponseType.OK]: 200,
  [ResponseType.ACCEPTED]: 202,
  [ResponseType.REDIRECTION]: 300,
  [ResponseType.MULTIPLE_CHOICES]: 300,
  [ResponseType.MOVED_PERMANENTLY]: 301,
  [ResponseType.MOVED_TEMPORARILY]: 302,
  [ResponseType.USE_PROXY]: 305,
  [ResponseType.ALTERNATIVE_SERVICE]: 380,
  [ResponseType.CLIENT_ERROR]: 400,
  [ResponseType.BAD_REQUEST]: 400,
  [ResponseType.UNAUTHORIZED]: 401,
  [ResponseType.PAYMENT_REQUIRED]: 402,
  [ResponseType.FORBIDDEN]: 403,
  [ResponseType.NOT_FOUND]: 404,
  [ResponseType.METHOD_NOT_ALLOWED]: 405,
  [ResponseType.NOT_ACCEPTABLE]: 406,
  [ResponseType.PROXY_AUTHENTICATION_REQUIRED]: 407,
  [ResponseType.REQUEST_TIMEOUT]: 408,
  [ResponseType.GONE]: 410,
  [ResponseType.REQUEST_ENTITY_TOO_LARGE]: 413,
  [ResponseType.REQUEST_URI_TOO_LONG]: 414,
  [ResponseType.UNSUPPORTED_MEDIA_TYPE]: 415,
  [ResponseType.UNSUPPORTED_URI_SCHEME]: 416,
  [ResponseType.BAD_EXTENSION]: 420,
  [ResponseType.EXTENSION_REQUIRED]: 421,
  [ResponseType.INTERVAL_TOO_BRIEF]: 423,
  [ResponseType.TEMPORARILY_UNAVAILABLE]: 480,
  [ResponseType.CALL_OR_TRANSACTION_DOES_NOT_EXIST]: 481,
  [ResponseType.LOOP_DETECTED]: 482,
  [ResponseType.TOO_MANY_HOPS]: 483,
  [ResponseType.ADDRESS_INCOMPLETE]: 484,
  [ResponseType.AMBIGUOUS]: 485,
  [ResponseType.BUSY_HERE]: 486,
  [ResponseType.REQUEST_TERMINATED]: 487,
  [ResponseType.NOT_ACCEPTABLE_HERE]: 488,
  [ResponseType.BAD_EVENT]: 489,
  [ResponseType.REQUEST_PENDING]: 491,
  [ResponseType.UNDECIPHERABLE]: 493,
  [ResponseType.SERVER_ERROR]: 500,
  [ResponseType.SERVER_INTERNAL_ERROR]: 500,
  [ResponseType.NOT_IMPLEMENTED]: 501,
  [ResponseType.BAD_GATEWAY]: 502,
  [ResponseType.SERVICE_UNAVAILABLE]: 503,
  [ResponseType.SERVER_TIMEOUT]: 504,
  [ResponseType.VERSION_NOT_SUPPORTED]: 505,
  [ResponseType.MESSAGE_TOO_LARGE]: 513,
  [ResponseType.GLOBAL_ERROR]: 600,
  [ResponseType.BUSY_EVERYWHERE]: 600,
  [ResponseType.DECLINE]: 603,
  [ResponseType.DOES_NOT_EXIST_ANYWHERE]: 604,
  [ResponseType.SESSION_NOT_ACCEPTABLE]: 606
}

/**
 * Returns the numeric SIP status for a response type, or undefined when the
 * type is unknown.
 *
 * @param {string} responseType - A ResponseType name as carried by the proto
 * @return {number | undefined} The status code
 */
export function statusCodeOf(responseType?: string): number | undefined {
  return responseType ? STATUS_CODES[responseType] : undefined
}

/**
 * Returns a lowercase reason phrase for a response type, e.g. "ringing".
 *
 * @param {string} responseType - A ResponseType name as carried by the proto
 * @return {string} The phrase
 */
export function reasonPhraseOf(responseType?: string): string {
  return (responseType || "unknown").toLowerCase().replace(/_/g, " ")
}

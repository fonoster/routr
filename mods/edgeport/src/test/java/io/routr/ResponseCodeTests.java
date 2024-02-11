/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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
package io.routr;

import io.routr.headers.ResponseCode;
import io.routr.message.ResponseType;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class ResponseCodeTests {
  @Test
  public void checkCodes() {
    assertEquals(-1, ResponseCode.valueOf(ResponseType.UNKNOWN.toString()).getCode());
    assertEquals(100, ResponseCode.valueOf(ResponseType.TRYING.toString()).getCode());
    assertEquals(180, ResponseCode.valueOf(ResponseType.RINGING.toString()).getCode());
    assertEquals(181, ResponseCode.valueOf(ResponseType.CALL_IS_BEING_FORWARDED.toString()).getCode());
    assertEquals(182, ResponseCode.valueOf(ResponseType.QUEUED.toString()).getCode());
    assertEquals(183, ResponseCode.valueOf(ResponseType.SESSION_PROGRESS.toString()).getCode());
    assertEquals(200, ResponseCode.valueOf(ResponseType.OK.toString()).getCode());
    assertEquals(202, ResponseCode.valueOf(ResponseType.ACCEPTED.toString()).getCode());
    assertEquals(300, ResponseCode.valueOf(ResponseType.MULTIPLE_CHOICES.toString()).getCode());
    assertEquals(301, ResponseCode.valueOf(ResponseType.MOVED_PERMANENTLY.toString()).getCode());
    assertEquals(302, ResponseCode.valueOf(ResponseType.MOVED_TEMPORARILY.toString()).getCode());
    assertEquals(305, ResponseCode.valueOf(ResponseType.USE_PROXY.toString()).getCode());
    assertEquals(380, ResponseCode.valueOf(ResponseType.ALTERNATIVE_SERVICE.toString()).getCode());
    assertEquals(400, ResponseCode.valueOf(ResponseType.BAD_REQUEST.toString()).getCode());
    assertEquals(401, ResponseCode.valueOf(ResponseType.UNAUTHORIZED.toString()).getCode());
    assertEquals(402, ResponseCode.valueOf(ResponseType.PAYMENT_REQUIRED.toString()).getCode());
    assertEquals(403, ResponseCode.valueOf(ResponseType.FORBIDDEN.toString()).getCode());
    assertEquals(404, ResponseCode.valueOf(ResponseType.NOT_FOUND.toString()).getCode());
    assertEquals(405, ResponseCode.valueOf(ResponseType.METHOD_NOT_ALLOWED.toString()).getCode());
    assertEquals(406, ResponseCode.valueOf(ResponseType.NOT_ACCEPTABLE.toString()).getCode());
    assertEquals(407, ResponseCode.valueOf(ResponseType.PROXY_AUTHENTICATION_REQUIRED.toString()).getCode());
    assertEquals(408, ResponseCode.valueOf(ResponseType.REQUEST_TIMEOUT.toString()).getCode());
    assertEquals(410, ResponseCode.valueOf(ResponseType.GONE.toString()).getCode());
    assertEquals(413, ResponseCode.valueOf(ResponseType.REQUEST_ENTITY_TOO_LARGE.toString()).getCode());
    assertEquals(414, ResponseCode.valueOf(ResponseType.REQUEST_URI_TOO_LONG.toString()).getCode());
    assertEquals(415, ResponseCode.valueOf(ResponseType.UNSUPPORTED_MEDIA_TYPE.toString()).getCode());
    assertEquals(416, ResponseCode.valueOf(ResponseType.UNSUPPORTED_URI_SCHEME.toString()).getCode());
    assertEquals(420, ResponseCode.valueOf(ResponseType.BAD_EXTENSION.toString()).getCode());
    assertEquals(421, ResponseCode.valueOf(ResponseType.EXTENSION_REQUIRED.toString()).getCode());
    assertEquals(423, ResponseCode.valueOf(ResponseType.INTERVAL_TOO_BRIEF.toString()).getCode());
    assertEquals(480, ResponseCode.valueOf(ResponseType.TEMPORARILY_UNAVAILABLE.toString()).getCode());
    assertEquals(481, ResponseCode.valueOf(ResponseType.CALL_OR_TRANSACTION_DOES_NOT_EXIST.toString()).getCode());
    assertEquals(482, ResponseCode.valueOf(ResponseType.LOOP_DETECTED.toString()).getCode());
    assertEquals(483, ResponseCode.valueOf(ResponseType.TOO_MANY_HOPS.toString()).getCode());
    assertEquals(484, ResponseCode.valueOf(ResponseType.ADDRESS_INCOMPLETE.toString()).getCode());
    assertEquals(485, ResponseCode.valueOf(ResponseType.AMBIGUOUS.toString()).getCode());
    assertEquals(486, ResponseCode.valueOf(ResponseType.BUSY_HERE.toString()).getCode());
    assertEquals(487, ResponseCode.valueOf(ResponseType.REQUEST_TERMINATED.toString()).getCode());
    assertEquals(488, ResponseCode.valueOf(ResponseType.NOT_ACCEPTABLE_HERE.toString()).getCode());
    assertEquals(489, ResponseCode.valueOf(ResponseType.BAD_EVENT.toString()).getCode());
    assertEquals(491, ResponseCode.valueOf(ResponseType.REQUEST_PENDING.toString()).getCode());
    assertEquals(493, ResponseCode.valueOf(ResponseType.UNDECIPHERABLE.toString()).getCode());
    assertEquals(500, ResponseCode.valueOf(ResponseType.SERVER_INTERNAL_ERROR.toString()).getCode());
    assertEquals(501, ResponseCode.valueOf(ResponseType.NOT_IMPLEMENTED.toString()).getCode());
    assertEquals(502, ResponseCode.valueOf(ResponseType.BAD_GATEWAY.toString()).getCode());
    assertEquals(503, ResponseCode.valueOf(ResponseType.SERVICE_UNAVAILABLE.toString()).getCode());
    assertEquals(504, ResponseCode.valueOf(ResponseType.SERVER_TIMEOUT.toString()).getCode());
    assertEquals(505, ResponseCode.valueOf(ResponseType.VERSION_NOT_SUPPORTED.toString()).getCode());
    assertEquals(513, ResponseCode.valueOf(ResponseType.MESSAGE_TOO_LARGE.toString()).getCode());
    assertEquals(600, ResponseCode.valueOf(ResponseType.BUSY_EVERYWHERE.toString()).getCode());
    assertEquals(603, ResponseCode.valueOf(ResponseType.DECLINE.toString()).getCode());
    assertEquals(604, ResponseCode.valueOf(ResponseType.DOES_NOT_EXIST_ANYWHERE.toString()).getCode());
    assertEquals(606, ResponseCode.valueOf(ResponseType.SESSION_NOT_ACCEPTABLE.toString()).getCode());
  }
}

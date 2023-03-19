/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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

import java.util.HashMap;
import java.util.Map;

public class HangupCauses {

  private static final Map<Integer, String> hangupCauses = new HashMap<>();

  // See the link below for reference:
  //  https://www.voicehost.co.uk/help/sip-error-codes-sip-trunk-troubleshooting
  static {
    hangupCauses.put(200, "NORMAL_CLEARING");
    hangupCauses.put(401, "CALL_REJECTED");
    hangupCauses.put(403, "CALL_REJECTED");
    hangupCauses.put(404, "UNALLOCATED");
    hangupCauses.put(407, "CALL_REJECTED");
    hangupCauses.put(408, "NO_USER_RESPONSE");
    hangupCauses.put(420, "NO_ROUTE_DESTINATION");
    hangupCauses.put(480, "NO_ANSWER");
    hangupCauses.put(483, "NO_ANSWER");
    hangupCauses.put(486, "USER_BUSY");
    hangupCauses.put(487, "NORMAL_CLEARING");
    hangupCauses.put(488, "NOT_ACCEPTABLE_HERE");
    hangupCauses.put(503, "SERVICE_UNAVAILABLE");
    hangupCauses.put(600, "USER_BUSY");
    hangupCauses.put(604, "UNALLOCATED");
    hangupCauses.put(603, "CALL_REJECTED");
    hangupCauses.put(484, "INVALID_NUMBER_FORMAT");
    hangupCauses.put(485, "UNALLOCATED");
  }

  public static String get(int code) {
    if (!hangupCauses.containsKey(code)) {
      return "UNKNOWN";
    }
    return hangupCauses.get(code);
  }
}

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
package io.routr.utils;

import javax.sip.header.ContactHeader;
import javax.sip.header.ExpiresHeader;
import javax.sip.message.Request;

/**
 * Helper class with static utility methods for working with SIP requests.
 */
public class RequestHelper {

  /**
   * Gets the expiry a REGISTER asks for. The Contact expires parameter takes
   * precedence over the Expires header (RFC 3261 section 10.3, step 6).
   * 
   * @param request The REGISTER request
   * @return the expiry in seconds, or 0 if the request carries none
   */
  public static int getRegisterExpires(final Request request) {
    var contact = (ContactHeader) request.getHeader(ContactHeader.NAME);
    if (contact != null && contact.getExpires() > -1) {
      return contact.getExpires();
    }
    var expires = (ExpiresHeader) request.getHeader(ExpiresHeader.NAME);
    return expires != null ? expires.getExpires() : 0;
  }
}

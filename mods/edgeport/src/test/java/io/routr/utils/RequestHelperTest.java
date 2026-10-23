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

import org.junit.jupiter.api.Test;

import javax.sip.SipFactory;
import javax.sip.message.MessageFactory;
import javax.sip.message.Request;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class RequestHelperTest {

  private static Request register(String extraHeaders) throws Exception {
    MessageFactory messageFactory = SipFactory.getInstance().createMessageFactory();
    return messageFactory.createRequest(
        "REGISTER sip:sip.local SIP/2.0\r\n"
            + "Via: SIP/2.0/UDP 192.168.1.2:5060;branch=z9hG4bK776asdhds\r\n"
            + "From: <sip:1001@sip.local>;tag=1928301774\r\n"
            + "To: <sip:1001@sip.local>\r\n"
            + "Call-ID: a84b4c76e66710\r\n"
            + "CSeq: 1 REGISTER\r\n"
            + "Max-Forwards: 70\r\n"
            + extraHeaders
            + "Content-Length: 0\r\n\r\n");
  }

  @Test
  public void contactExpiresTakesPrecedence() throws Exception {
    Request request = register(
        "Contact: <sip:1001@192.168.1.2:5060>;expires=600\r\nExpires: 60\r\n");
    assertEquals(600, RequestHelper.getRegisterExpires(request));
  }

  @Test
  public void fallsBackToExpiresHeader() throws Exception {
    Request request = register("Contact: <sip:1001@192.168.1.2:5060>\r\nExpires: 60\r\n");
    assertEquals(60, RequestHelper.getRegisterExpires(request));
  }

  @Test
  public void returnsZeroWhenNoExpiryIsPresent() throws Exception {
    Request request = register("Contact: <sip:1001@192.168.1.2:5060>\r\n");
    assertEquals(0, RequestHelper.getRegisterExpires(request));
  }
}

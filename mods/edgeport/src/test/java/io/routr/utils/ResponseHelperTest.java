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

import javax.sip.header.FromHeader;
import javax.sip.header.ToHeader;
import javax.sip.message.MessageFactory;
import javax.sip.message.Request;
import javax.sip.message.Response;
import javax.sip.SipFactory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class ResponseHelperTest {

  @Test
  public void hasCodesIdentifies183SessionProgress() throws Exception {
    MessageFactory messageFactory = SipFactory.getInstance().createMessageFactory();
    Response sessionProgress = messageFactory.createResponse(
        "SIP/2.0 183 Session Progress\r\n\r\n");
    Response ok = messageFactory.createResponse(
        "SIP/2.0 200 OK\r\n\r\n");

    assertTrue(ResponseHelper.hasCodes(sessionProgress, Response.SESSION_PROGRESS));
    assertFalse(ResponseHelper.hasCodes(ok, Response.SESSION_PROGRESS));
  }

  // The caller's INVITE, as it reached the EdgePort
  private static final String CALLER_INVITE = "INVITE sip:17853178071@sip.local SIP/2.0\r\n"
      + "Via: SIP/2.0/UDP 10.0.0.2:5060;branch=z9hG4bK-caller\r\n"
      + "From: \"John Doe\" <sip:1001@sip.local>;tag=caller-tag\r\n"
      + "To: <sip:17853178071@sip.local>\r\n"
      + "Call-ID: call-1\r\n"
      + "CSeq: 1 INVITE\r\n"
      + "Max-Forwards: 70\r\n"
      + "Content-Length: 0\r\n\r\n";

  // The carrier's answer to the INVITE the Trunk sent: the rewritten identity
  private static final String TRUNK_OK = "SIP/2.0 200 OK\r\n"
      + "Via: SIP/2.0/UDP 10.0.0.2:5060;branch=z9hG4bK-caller\r\n"
      + "From: \"John Doe\" <sip:+18295863314@sip.provider.net;user=phone>;tag=caller-tag\r\n"
      + "To: <sip:+17853178071@sip.local>;tag=callee-tag\r\n"
      + "Call-ID: call-1\r\n"
      + "CSeq: 1 INVITE\r\n"
      + "Content-Length: 0\r\n\r\n";

  @Test
  public void restoreIdentityGivesTheCallerItsOwnFromAndTo() throws Exception {
    MessageFactory messageFactory = SipFactory.getInstance().createMessageFactory();
    Request invite = messageFactory.createRequest(CALLER_INVITE);
    Response ok = messageFactory.createResponse(TRUNK_OK);

    ResponseHelper.restoreIdentity(ok, invite);

    var from = (FromHeader) ok.getHeader(FromHeader.NAME);
    var to = (ToHeader) ok.getHeader(ToHeader.NAME);
    assertEquals("sip:1001@sip.local", from.getAddress().getURI().toString());
    assertEquals("caller-tag", from.getTag());
    assertEquals("sip:17853178071@sip.local", to.getAddress().getURI().toString());
    // The tag the callee added survives: it names the dialog
    assertEquals("callee-tag", to.getTag());
    // One of each, not the carrier's next to the caller's
    assertEquals(1, countHeaders(ok, FromHeader.NAME));
    assertEquals(1, countHeaders(ok, ToHeader.NAME));
  }

  @Test
  public void restoreIdentityKeepsAProvisionalResponseWithoutAToTag() throws Exception {
    MessageFactory messageFactory = SipFactory.getInstance().createMessageFactory();
    Request invite = messageFactory.createRequest(CALLER_INVITE);
    Response ringing = messageFactory.createResponse(
        TRUNK_OK.replace("200 OK", "180 Ringing").replace(";tag=callee-tag", ""));

    ResponseHelper.restoreIdentity(ringing, invite);

    var to = (ToHeader) ringing.getHeader(ToHeader.NAME);
    assertEquals("sip:17853178071@sip.local", to.getAddress().getURI().toString());
    assertNull(to.getTag());
  }

  @Test
  public void restoreIdentityWithoutTheOriginalLeavesTheResponseAlone() throws Exception {
    MessageFactory messageFactory = SipFactory.getInstance().createMessageFactory();
    Response ok = messageFactory.createResponse(TRUNK_OK);

    ResponseHelper.restoreIdentity(ok, null);

    var from = (FromHeader) ok.getHeader(FromHeader.NAME);
    assertEquals("sip:+18295863314@sip.provider.net;user=phone", from.getAddress().getURI().toString());
  }

  private static int countHeaders(Response response, String name) {
    int count = 0;
    var headers = response.getHeaders(name);
    while (headers.hasNext()) {
      headers.next();
      count++;
    }
    return count;
  }
}

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
import javax.sip.header.ProxyAuthenticateHeader;
import javax.sip.header.WWWAuthenticateHeader;
import javax.sip.message.MessageFactory;
import javax.sip.message.Response;
import java.util.ArrayList;
import java.util.List;
import java.util.ListIterator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

public class AuthenticationHandlerTest {
  private final MessageFactory messageFactory;

  public AuthenticationHandlerTest() throws Exception {
    messageFactory = SipFactory.getInstance().createMessageFactory();
  }

  private Response challenge(int code, String header, String... algorithms) throws Exception {
    var sb = new StringBuilder()
        .append("SIP/2.0 ").append(code).append(code == 401 ? " Unauthorized" : " Proxy Authentication Required").append("\r\n")
        .append("Via: SIP/2.0/TLS 203.0.113.10:5061;branch=z9hG4bK-1\r\n")
        .append("From: <sip:+15551234567@sip.example.com>;tag=a\r\n")
        .append("To: <sip:+15557654321@wa.meta.vc>;tag=b\r\n")
        .append("Call-ID: abc\r\n")
        .append("CSeq: 2 INVITE\r\n");
    for (var algorithm : algorithms) {
      sb.append(header).append(": Digest realm=\"wa.meta.vc\",nonce=\"n\",qop=\"auth\"");
      if (algorithm != null) {
        sb.append(",algorithm=").append(algorithm);
      }
      sb.append("\r\n");
    }
    sb.append("Content-Length: 0\r\n\r\n");
    return messageFactory.createResponse(sb.toString());
  }

  private List<String> algorithms(Response response, String header) {
    var out = new ArrayList<String>();
    ListIterator<?> it = response.getHeaders(header);
    while (it.hasNext()) {
      out.add(String.valueOf(((WWWAuthenticateHeader) it.next()).getAlgorithm()));
    }
    return out;
  }

  @Test
  public void keepsOnlyTheMd5ChallengeWhenSha256IsAlsoOffered() throws Exception {
    // What Meta's WhatsApp SIP gateway sends: SHA-256 first, then MD5
    var response = challenge(407, ProxyAuthenticateHeader.NAME, "SHA-256", "MD5");

    var filtered = AuthenticationHandler.withSupportedChallenges(response);

    assertEquals(List.of("MD5"), algorithms(filtered, ProxyAuthenticateHeader.NAME));
    // The response the stack received is left as it was
    assertEquals(List.of("SHA-256", "MD5"), algorithms(response, ProxyAuthenticateHeader.NAME));
  }

  @Test
  public void appliesTo401ChallengesToo() throws Exception {
    var response = challenge(401, WWWAuthenticateHeader.NAME, "SHA-512-256", "MD5");

    var filtered = AuthenticationHandler.withSupportedChallenges(response);

    assertEquals(List.of("MD5"), algorithms(filtered, WWWAuthenticateHeader.NAME));
  }

  @Test
  public void treatsAMissingAlgorithmAsMd5() throws Exception {
    var response = challenge(407, ProxyAuthenticateHeader.NAME, "SHA-256", null);

    var filtered = AuthenticationHandler.withSupportedChallenges(response);

    assertEquals(List.of("null"), algorithms(filtered, ProxyAuthenticateHeader.NAME));
  }

  @Test
  public void leavesTheResponseAloneWhenEveryChallengeIsSupported() throws Exception {
    var response = challenge(407, ProxyAuthenticateHeader.NAME, "MD5");

    assertSame(response, AuthenticationHandler.withSupportedChallenges(response));
  }

  @Test
  public void leavesTheResponseAloneWhenNoChallengeIsSupported() throws Exception {
    // Nothing to answer correctly; let the stack try and the server's error show
    var response = challenge(407, ProxyAuthenticateHeader.NAME, "SHA-256");

    assertSame(response, AuthenticationHandler.withSupportedChallenges(response));
  }
}

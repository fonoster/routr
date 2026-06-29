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
package io.routr.requester;

import org.junit.jupiter.api.Test;

import javax.sip.*;
import java.io.IOException;
import java.net.ServerSocket;

import static org.junit.jupiter.api.Assertions.*;

public class SIPProviderBuilderTests {

  private static int findFreePort() throws IOException {
    try (ServerSocket socket = new ServerSocket(0)) {
      return socket.getLocalPort();
    }
  }

  @Test
  public void testCreateSipProvider() throws Exception {
    // Use a dynamically chosen free port so the test does not fail with BindException when 5060 is in use.
    // JAIN SIP does not accept port 0.
    int port = findFreePort();
    SipProvider provider = SIPProviderBuilder.createSipProvider(null, "localhost:" + port);
    assertNotNull(provider);
    assertEquals(2, provider.getListeningPoints().length);
    assertEquals("tcp", provider.getListeningPoint("tcp").getTransport().toLowerCase());
    assertEquals("udp", provider.getListeningPoint("udp").getTransport().toLowerCase());
    assertEquals("routr-requester", provider.getSipStack().getStackName());
    assertNull(provider.getListeningPoint("wss"));
  }
}

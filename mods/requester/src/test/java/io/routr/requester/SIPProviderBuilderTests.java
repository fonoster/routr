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
package io.routr.requester;

import org.junit.jupiter.api.Test;
import javax.sip.*;
import static org.junit.jupiter.api.Assertions.*;

public class SIPProviderBuilderTests {

  @Test
  public void testCreateSipProvider() throws PeerUnavailableException, TransportNotSupportedException, InvalidArgumentException,
  ObjectInUseException, TransportAlreadySupportedException {
    SipProvider provider = SIPProviderBuilder.createSipProvider(null, "localhost:5060");
    assertNotNull(provider);
    assertEquals(2, provider.getListeningPoints().length);
    assertEquals("tcp", provider.getListeningPoint("tcp").getTransport().toLowerCase());
    assertEquals("udp", provider.getListeningPoint("udp").getTransport().toLowerCase());
    assertEquals("routr-requester", provider.getSipStack().getStackName());
    assertNull(provider.getListeningPoint("wss"));
  }
}

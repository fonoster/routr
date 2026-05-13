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
package io.routr.sip;

import gov.nist.javax.sip.stack.NioMessageProcessorFactory;
import gov.nist.javax.sip.stack.NioTlsWebSocketMessageProcessor;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Compile-time/structure-level sanity for the WSS swap: makes sure the safe
 * factory and processor still extend the stock types and override the right
 * surface, so JAIN-SIP picks them up when wired via
 * {@code gov.nist.javax.sip.MESSAGE_PROCESSOR_FACTORY}.
 *
 * <p>End-to-end instantiation requires a complete SIP stack + SSL context and
 * is therefore exercised by the broader compose-based smoke tests, not here.
 */
public class SafeNioMessageProcessorFactoryTest {

  @Test
  public void factoryExtendsStockFactory_soJainSipCanLoadIt() {
    assertTrue(NioMessageProcessorFactory.class
        .isAssignableFrom(SafeNioMessageProcessorFactory.class));
  }

  @Test
  public void factoryOverridesCreateMessageProcessor() throws NoSuchMethodException {
    Method override = SafeNioMessageProcessorFactory.class.getDeclaredMethod(
        "createMessageProcessor",
        gov.nist.javax.sip.stack.SIPTransactionStack.class,
        java.net.InetAddress.class,
        int.class,
        String.class);

    assertNotNull(override);
    assertEquals(SafeNioMessageProcessorFactory.class, override.getDeclaringClass(),
        "createMessageProcessor must be overridden on SafeNioMessageProcessorFactory");
  }

  @Test
  public void safeProcessorIsRecognisedAsStockProcessor() {
    assertTrue(NioTlsWebSocketMessageProcessor.class
        .isAssignableFrom(SafeNioTlsWebSocketMessageProcessor.class));
  }
}

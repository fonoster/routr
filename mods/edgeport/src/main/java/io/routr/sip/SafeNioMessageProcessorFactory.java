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

import gov.nist.javax.sip.ListeningPointExt;
import gov.nist.javax.sip.SipStackImpl;
import gov.nist.javax.sip.stack.MessageProcessor;
import gov.nist.javax.sip.stack.NioMessageProcessorFactory;
import gov.nist.javax.sip.stack.SIPTransactionStack;

import java.io.IOException;
import java.net.InetAddress;

/**
 * Drop-in replacement for {@link NioMessageProcessorFactory} that swaps in
 * {@link SafeNioTlsWebSocketMessageProcessor} for WSS listening points so the
 * StackOverflowError described in {@link SafeNioTlsWebSocketMessageChannel}
 * cannot kill {@code EventScannerThread}.
 *
 * <p>All other transports (UDP, TCP, TLS, plain WS, SCTP) fall through to the
 * standard factory and are unaffected. Plain WS does not suffer from the same
 * recursion because {@code NioWebSocketMessageChannel.onNewSocket} is a no-op
 * delegate to {@code NioTcpMessageChannel.onNewSocket}.
 */
public class SafeNioMessageProcessorFactory extends NioMessageProcessorFactory {

  @Override
  public MessageProcessor createMessageProcessor(SIPTransactionStack sipStack,
      InetAddress ipAddress, int port, String transport) throws IOException {

    boolean useTlsGateway = "true".equals(((SipStackImpl) sipStack)
        .getConfigurationProperties()
        .getProperty("gov.nist.javax.sip.USE_TLS_GATEWAY"));

    if ("WSS".equalsIgnoreCase(transport) && !useTlsGateway) {
      // Default Routr deployment: WSS terminated inside JAIN-SIP itself.
      // Returning our safe processor instead of NioTlsWebSocketMessageProcessor.
      return new SafeNioTlsWebSocketMessageProcessor(ipAddress, sipStack, port, "WSS");
    }

    if (ListeningPointExt.WS.equalsIgnoreCase(transport) && useTlsGateway) {
      // TLS-gateway mode: JAIN-SIP wires a TLS-capable WSS processor and
      // labels it as WS. That path goes through the same recursive onNewSocket
      // codepath, so we patch it too.
      return new SafeNioTlsWebSocketMessageProcessor(ipAddress, sipStack, port, "WS");
    }

    return super.createMessageProcessor(sipStack, ipAddress, port, transport);
  }
}

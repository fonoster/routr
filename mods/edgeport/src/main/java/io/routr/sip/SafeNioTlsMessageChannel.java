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

import gov.nist.javax.sip.stack.NioTcpMessageProcessor;
import gov.nist.javax.sip.stack.NioTlsMessageChannel;
import gov.nist.javax.sip.stack.SIPTransactionStack;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.IOException;
import java.net.InetAddress;
import java.nio.channels.SocketChannel;

/**
 * Drop-in replacement for {@link NioTlsMessageChannel} that lets the EdgePort
 * open a TLS connection to a carrier or peer. With stock JAIN-SIP 1.3.0-91 in
 * non-blocking NIO mode, the first message sent over a TLS channel we initiate
 * recurses until the sending thread dies with a {@code StackOverflowError}.
 *
 * <p>What happens in the stock code:
 * <pre>
 *   sendTCPMessage -> nioHandler.sendBytes -> openOutgoingConnection
 *     opens socket B, puts it in the socket table, then removes it again in its
 *     finally block because "connected" is never set for a non-blocking connect
 *   sendTCPMessage sees B != current socket -> onNewSocket(message)
 *   NioTlsMessageChannel.onNewSocket -> init(true) -> sendMessage(message)
 *     -> wrap -> doSend -> sendTCPMessage -> sendBytes
 *     the table no longer has B, so a socket C is opened, C != B -> onNewSocket
 *     ... forever
 * </pre>
 *
 * <p>The fix is to put the socket {@code sendTCPMessage} just swapped in back
 * into the socket table before the stock {@code onNewSocket} resends. The
 * resend then finds that socket, queues the TLS ClientHello on it and returns.
 * As a safety net, a re-entrant call while that resend is in flight is dropped
 * and logged instead of recursing.
 *
 * <p>Server-side channels (a carrier or phone connecting to us) are created by
 * the same processor and get this class too; their {@code onNewSocket} is not
 * reached in practice, and the re-registration is harmless for them.
 */
public class SafeNioTlsMessageChannel extends NioTlsMessageChannel {

  private static final Logger LOG = LogManager.getLogger(SafeNioTlsMessageChannel.class);

  // onNewSocket runs synchronously on the thread that sends, so a plain field
  // is enough to detect re-entry on this channel.
  private boolean reconnecting;

  protected SafeNioTlsMessageChannel(NioTcpMessageProcessor nioTcpMessageProcessor,
      SocketChannel socketChannel) throws IOException {
    super(nioTcpMessageProcessor, socketChannel);
  }

  public SafeNioTlsMessageChannel(InetAddress inetAddress, int port,
      SIPTransactionStack sipStack,
      NioTcpMessageProcessor nioTcpMessageProcessor) throws IOException {
    super(inetAddress, port, sipStack, nioTcpMessageProcessor);
    // The constructor opened a connection to the peer and the socket table
    // dropped it at once. Put it back, so the first send uses this connection
    // instead of opening a second one and closing this one without a byte
    // (which the peer's OpenSSL reports as a protocol error).
    registerSocket();
  }

  private void registerSocket() {
    if (messageProcessor instanceof SafeNioTlsMessageProcessor && socketChannel != null) {
      ((SafeNioTlsMessageProcessor) messageProcessor)
          .registerOutgoingSocket(peerAddress, peerPort, socketChannel);
    }
  }

  /**
   * Sets {@code isCached = true} from inside the channel hierarchy so
   * {@link SafeNioTlsMessageProcessor} doesn't violate protected-access rules.
   */
  void markCached() {
    this.isCached = true;
  }

  @Override
  public void onNewSocket(byte[] message) {
    if (reconnecting) {
      LOG.warn(
          "TLS channel re-entered onNewSocket while reconnecting; dropping {} buffered byte(s) "
              + "to avoid the JAIN-SIP onNewSocket -> sendMessage recursion. peerAddress={}, peerPort={}",
          message != null ? message.length : 0, peerAddress, peerPort);
      return;
    }

    reconnecting = true;
    try {
      // Put the socket sendTCPMessage just gave us back into the socket table,
      // where openOutgoingConnection's finally block dropped it. The resend in
      // the stock onNewSocket then reuses it instead of opening another one.
      registerSocket();
      super.onNewSocket(message);
    } finally {
      reconnecting = false;
    }
  }
}

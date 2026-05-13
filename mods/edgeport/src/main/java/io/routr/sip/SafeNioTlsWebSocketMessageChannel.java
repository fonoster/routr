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
import gov.nist.javax.sip.stack.NioTlsWebSocketMessageChannel;
import gov.nist.javax.sip.stack.SIPTransactionStack;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.IOException;
import java.net.InetAddress;
import java.nio.channels.SocketChannel;

/**
 * Drop-in replacement for {@link NioTlsWebSocketMessageChannel} that breaks
 * the infinite recursion in JAIN-SIP 1.3.0-91 when a WSS peer disconnects
 * and the stack tries to retransmit on the dead channel.
 *
 * <p>Stock JAIN-SIP behaviour, abbreviated, is:
 * <pre>
 *   sendMessage -> sslStateMachine.wrap -> doSend
 *               -> sendNonWebSocketMessage
 *               -> sendTCPMessage (creates a new TCP socket)
 *               -> onNewSocket(message)
 *               -> sendMessage  // back to the top, forever
 * </pre>
 *
 * <p>The recursion eventually exhausts the stack of the {@code EventScannerThread}
 * (or whatever thread initiated the send), which dies, taking SIP processing
 * with it while leaving the JVM otherwise alive. The HealthCheck and other
 * subsystems keep responding, but no further SIP traffic is processed —
 * Routr "hangs silently" after a few days of WebRTC usage.
 *
 * <p>From the server's perspective, when a browser-side WSS connection drops,
 * there is no valid path to reopen it: WebSocket is client-initiated and the
 * new TCP socket JAIN-SIP creates here will never complete a WS upgrade. The
 * safe thing to do is drop the pending message, let the transaction time out
 * normally, and rely on {@code processIOException} to clean up. That is what
 * this override does.
 */
public class SafeNioTlsWebSocketMessageChannel extends NioTlsWebSocketMessageChannel {

  private static final Logger LOG = LogManager.getLogger(SafeNioTlsWebSocketMessageChannel.class);

  protected SafeNioTlsWebSocketMessageChannel(SIPTransactionStack sipStack,
      NioTcpMessageProcessor nioTcpMessageProcessor,
      SocketChannel socketChannel) throws IOException {
    super(sipStack, nioTcpMessageProcessor, socketChannel);
  }

  public SafeNioTlsWebSocketMessageChannel(InetAddress inetAddress, int port,
      SIPTransactionStack sipStack,
      NioTcpMessageProcessor nioTcpMessageProcessor) throws IOException {
    super(inetAddress, port, sipStack, nioTcpMessageProcessor);
  }

  /**
   * Sets {@code isCached = true} from inside the channel hierarchy so callers
   * in a different package (notably {@link SafeNioTlsWebSocketMessageProcessor})
   * don't violate JVM protected-access rules.
   */
  void markCached() {
    this.isCached = true;
  }

  /**
   * Intentionally does NOT re-invoke {@code sendMessage} on the freshly opened
   * TCP socket. The original implementation re-sends the buffered message via
   * {@code sendMessage(message, false)} which, on a server-side WSS channel
   * whose peer just disconnected, restarts the very recursion described in the
   * class-level Javadoc.
   *
   * <p>We delegate to {@code super.super.onNewSocket} (i.e. the no-op in
   * {@code NioTcpMessageChannel}) by skipping the buggy override entirely, log
   * the dropped message at debug level, and return. The SIP transaction layer
   * will time out the request normally.
   */
  @Override
  public void onNewSocket(byte[] message) {
    int size = message != null ? message.length : 0;
    LOG.warn(
        "WSS channel reconnected after peer disconnect; dropping {} buffered byte(s) " +
        "to avoid JAIN-SIP onNewSocket -> sendMessage recursion. " +
        "peerAddress={}, peerPort={}, transport={}",
        size, peerAddress, peerPort, getTransport());

    // Note: we intentionally do NOT call super.onNewSocket(message) because that
    // is the buggy path that recurses through sendMessage -> sendTCPMessage ->
    // onNewSocket. Skipping it is safe: the only side effect of the parent
    // implementation is to retry the send, which we explicitly do not want.
  }
}

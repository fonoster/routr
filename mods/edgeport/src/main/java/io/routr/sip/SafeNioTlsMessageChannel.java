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
import gov.nist.javax.sip.stack.SSLStateMachine;
import gov.nist.javax.sip.stack.SIPTransactionStack;
import io.routr.telemetry.Telemetry;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import javax.net.ssl.SSLEngine;
import javax.net.ssl.SSLEngineResult.HandshakeStatus;
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

  // NioTlsMessageChannel.sslStateMachine and SSLStateMachine.sslEngine are
  // package-private in JAIN-SIP; SSLStateMachine.wrapLock and wrapNonAppData are
  // private
  private static final Field SSL_STATE_MACHINE;
  private static final Field SSL_ENGINE;
  private static final Field WRAP_LOCK;
  private static final Method WRAP_NON_APP_DATA;

  static {
    Field stateMachine = null;
    Field engine = null;
    Field wrapLock = null;
    Method wrapNonAppData = null;
    try {
      stateMachine = NioTlsMessageChannel.class.getDeclaredField("sslStateMachine");
      stateMachine.setAccessible(true);
      engine = SSLStateMachine.class.getDeclaredField("sslEngine");
      engine.setAccessible(true);
      wrapLock = SSLStateMachine.class.getDeclaredField("wrapLock");
      wrapLock.setAccessible(true);
      wrapNonAppData = SSLStateMachine.class.getDeclaredMethod("wrapNonAppData");
      wrapNonAppData.setAccessible(true);
    } catch (ReflectiveOperationException | RuntimeException e) {
      LOG.error("cannot reach JAIN-SIP's TLS state machine; a TLS handshake may stall", e);
    }
    SSL_STATE_MACHINE = stateMachine;
    SSL_ENGINE = engine;
    WRAP_LOCK = wrapLock;
    WRAP_NON_APP_DATA = wrapNonAppData;
  }

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

  /**
   * Sends what was queued while the TLS handshake ran, as soon as it completes.
   *
   * <p>A message sent before the handshake finishes waits in the state machine's
   * queue. JAIN-SIP 1.3.0 sends that queue when the handshake finishes on the
   * receiving side (unwrap), but not when it finishes on the sending side
   * (wrapNonAppData). In TLS 1.3 the client's handshake ends with the client
   * sending its Finished message, so the first request on a new connection
   * waits until something else is written. Against Meta's WhatsApp gateway the
   * INVITE sat unsent until the caller's CANCEL pushed it out, 30 seconds later.
   * (A server that sends a session ticket right away, as OpenSSL does, hides
   * this: reading the ticket takes the unwrap path, which flushes.)
   */
  @Override
  public void setHandshakeCompleted(boolean handshakeCompleted) {
    super.setHandshakeCompleted(handshakeCompleted);
    if (!handshakeCompleted || SSL_STATE_MACHINE == null) {
      return;
    }
    try {
      var stateMachine = (SSLStateMachine) SSL_STATE_MACHINE.get(this);
      if (stateMachine != null) {
        // Sends the queued messages, if any; with an empty queue it does nothing
        stateMachine.wrapRemaining();
      }
    } catch (IllegalAccessException | IOException | RuntimeException e) {
      LOG.warn("could not send the messages queued during the TLS handshake; peerAddress={}, peerPort={}",
          peerAddress, peerPort, e);
    }
  }

  /**
   * Sends the handshake message the TLS engine is waiting to send, if any,
   * after the peer's bytes were processed.
   *
   * <p>JAIN-SIP 1.3.0's unwrap loop stops on BUFFER_UNDERFLOW (waiting for more
   * input) without looking at the handshake status. When the engine is in
   * NEED_WRAP at that point (its own handshake message is due, such as the
   * client's Finished), nothing sends it: the peer waits for us and we wait for
   * the peer. Seen with Meta's WhatsApp gateway on the connection a BYE opened;
   * the handshake never finished and the BYE never left.
   */
  @Override
  protected void addBytes(byte[] bytes) throws Exception {
    super.addBytes(bytes);
    if (SSL_STATE_MACHINE == null || SSL_ENGINE == null || WRAP_LOCK == null
        || WRAP_NON_APP_DATA == null) {
      return;
    }
    var stateMachine = (SSLStateMachine) SSL_STATE_MACHINE.get(this);
    if (stateMachine == null) {
      return;
    }
    var engine = (SSLEngine) SSL_ENGINE.get(stateMachine);
    var lock = WRAP_LOCK.get(stateMachine);
    // Sends the pending handshake records; finishing the handshake calls
    // setHandshakeCompleted, which sends what was queued meanwhile
    sendPendingHandshake(engine, lock, () -> {
      WRAP_NON_APP_DATA.invoke(stateMachine);
      return null;
    }, peerAddress + ":" + peerPort);
  }

  /**
   * Runs {@code wrap} when the engine has a handshake message due, under the
   * state machine's wrap lock.
   *
   * <p>The lock is the one SSLStateMachine.wrap holds: without it, a SIP message
   * sent from another thread at the same moment produces TLS records too, and
   * the two writes can reach the wire out of order, which the peer rejects
   * (bad_record_mac). The status is read again under the lock, since a send
   * that held it may have advanced the handshake meanwhile. An error is logged,
   * not thrown: it would otherwise end the read path of the connection.
   *
   * @param engine the TLS engine, or null
   * @param lock the state machine's wrap lock, or null
   * @param wrap what sends the handshake records
   * @param peer the peer, for the log
   * @return true when wrap ran and did not fail
   */
  static boolean sendPendingHandshake(SSLEngine engine, Object lock,
      java.util.concurrent.Callable<?> wrap, String peer) {
    if (engine == null || lock == null
        || engine.getHandshakeStatus() != HandshakeStatus.NEED_WRAP) {
      return false;
    }
    synchronized (lock) {
      if (engine.getHandshakeStatus() != HandshakeStatus.NEED_WRAP) {
        return false;
      }
      try {
        wrap.call();
        return true;
      } catch (Exception e) {
        var cause = e instanceof java.lang.reflect.InvocationTargetException && e.getCause() != null
            ? e.getCause()
            : e;
        LOG.warn("could not send the pending TLS handshake message; peer={}", peer, cause);
        return false;
      }
    }
  }

  @Override
  public void onNewSocket(byte[] message) {
    if (reconnecting) {
      LOG.warn(
          "TLS channel re-entered onNewSocket while reconnecting; dropping {} buffered byte(s) "
              + "to avoid the JAIN-SIP onNewSocket -> sendMessage recursion. peerAddress={}, peerPort={}, {}",
          message != null ? message.length : 0, peerAddress, peerPort,
          Telemetry.dropped("tls_reconnect", "tls", message));
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

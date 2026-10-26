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

import gov.nist.core.HostPort;
import gov.nist.javax.sip.stack.MessageChannel;
import gov.nist.javax.sip.stack.NIOHandler;
import gov.nist.javax.sip.stack.NioTcpMessageChannel;
import gov.nist.javax.sip.stack.NioTcpMessageProcessor;
import gov.nist.javax.sip.stack.NioTlsMessageProcessor;
import gov.nist.javax.sip.stack.SIPTransactionStack;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.IOException;
import java.lang.reflect.Method;
import java.net.InetAddress;
import java.nio.channels.SocketChannel;

/**
 * TLS message processor that produces {@link SafeNioTlsMessageChannel}
 * instances instead of the stock channel, so the EdgePort can open TLS
 * connections to carriers and peers (see the channel's Javadoc for the bug).
 *
 * <p>The {@code createMessageChannel} overloads mirror the stock
 * implementation in {@code NioTcpMessageProcessor}; the one they call,
 * {@code constructMessageChannel}, is package-private in JAIN-SIP and cannot
 * be overridden from here.
 */
public class SafeNioTlsMessageProcessor extends NioTlsMessageProcessor
    implements SiblingChannels.Cache {

  private static final Logger LOG = LogManager.getLogger(SafeNioTlsMessageProcessor.class);

  // NIOHandler.makeKey and NIOHandler.putSocket are protected in JAIN-SIP. They
  // are the socket table the stock code consults on every send, and the only
  // way to hand it a socket it already dropped is to call them.
  private static final Method MAKE_KEY;
  private static final Method PUT_SOCKET;

  static {
    Method makeKey = null;
    Method putSocket = null;
    try {
      makeKey = NIOHandler.class.getDeclaredMethod("makeKey", InetAddress.class, int.class);
      makeKey.setAccessible(true);
      putSocket = NIOHandler.class.getDeclaredMethod("putSocket", String.class, SocketChannel.class);
      putSocket.setAccessible(true);
    } catch (ReflectiveOperationException | RuntimeException e) {
      LOG.error("cannot reach JAIN-SIP's socket table; outbound TLS will not work", e);
    }
    MAKE_KEY = makeKey;
    PUT_SOCKET = putSocket;
  }

  public SafeNioTlsMessageProcessor(InetAddress ipAddress,
      SIPTransactionStack sipStack, int port) {
    super(ipAddress, sipStack, port);
  }

  /**
   * Records {@code socket} as the connection to {@code address:port} in the
   * NIO handler's socket table, so the next send to that peer reuses it.
   */
  void registerOutgoingSocket(InetAddress address, int port, SocketChannel socket) {
    if (MAKE_KEY == null || PUT_SOCKET == null || nioHandler == null) {
      return;
    }
    try {
      String key = (String) MAKE_KEY.invoke(null, address, port);
      PUT_SOCKET.invoke(nioHandler, key, socket);
    } catch (ReflectiveOperationException | RuntimeException e) {
      LOG.warn("cannot register the outgoing TLS socket for {}:{}", address, port, e);
    }
  }

  @Override
  public MessageChannel findOpenChannel(InetAddress peerAddress, int peerPort) {
    return SiblingChannels.findOpen(messageChannels,
        MessageChannel.getKey(peerAddress, peerPort, transport));
  }

  @Override
  public NioTcpMessageChannel createMessageChannel(
      NioTcpMessageProcessor nioTcpMessageProcessor,
      SocketChannel client) throws IOException {
    NioTcpMessageChannel cached = nioHandler.getMessageChannel(client);
    if (cached != null) {
      return cached;
    }
    SafeNioTlsMessageChannel created =
        new SafeNioTlsMessageChannel(nioTcpMessageProcessor, client);
    nioHandler.putMessageChannel(client, created);
    return created;
  }

  @Override
  public synchronized MessageChannel createMessageChannel(HostPort targetHostPort) throws IOException {
    return createMessageChannel(targetHostPort.getInetAddress(), targetHostPort.getPort());
  }

  @Override
  public synchronized MessageChannel createMessageChannel(InetAddress targetHost, int port) throws IOException {
    String key = MessageChannel.getKey(targetHost, port, transport);
    MessageChannel existing = messageChannels.get(key);
    if (existing != null) {
      return existing;
    }
    // A client whose TLS a proxy terminated is connected to the TCP listening
    // point and cannot accept a new connection (see SiblingChannels).
    MessageChannel sibling = SiblingChannels.find(this, sipStack, targetHost, port, "TCP");
    if (sibling != null) {
      return sibling;
    }
    SafeNioTlsMessageChannel retval =
        new SafeNioTlsMessageChannel(targetHost, port, sipStack, this);
    messageChannels.put(key, retval);
    retval.markCached();
    selector.wakeup();
    return retval;
  }
}

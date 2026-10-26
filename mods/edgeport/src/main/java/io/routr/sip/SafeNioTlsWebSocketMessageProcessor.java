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
import gov.nist.javax.sip.stack.NioTcpMessageChannel;
import gov.nist.javax.sip.stack.NioTcpMessageProcessor;
import gov.nist.javax.sip.stack.NioTlsWebSocketMessageProcessor;
import gov.nist.javax.sip.stack.SIPTransactionStack;

import java.io.IOException;
import java.net.InetAddress;
import java.nio.channels.SocketChannel;

/**
 * WSS message processor that produces {@link SafeNioTlsWebSocketMessageChannel}
 * instances instead of the buggy stock channel.
 *
 * <p>The three {@code createMessageChannel} overloads mirror the stock
 * implementation in {@code NioTlsWebSocketMessageProcessor} (which is private
 * inside JAIN-SIP 1.3.0-91) but instantiate our safe subclass.
 */
public class SafeNioTlsWebSocketMessageProcessor extends NioTlsWebSocketMessageProcessor
    implements SiblingChannels.Cache {

  public SafeNioTlsWebSocketMessageProcessor(InetAddress ipAddress,
      SIPTransactionStack sipStack, int port) {
    super(ipAddress, sipStack, port);
  }

  /**
   * Overload that lets the factory pick the transport label ("WS" vs "WSS")
   * without poking the protected {@code transport} field from outside the
   * MessageProcessor hierarchy.
   */
  public SafeNioTlsWebSocketMessageProcessor(InetAddress ipAddress,
      SIPTransactionStack sipStack, int port, String transport) {
    super(ipAddress, sipStack, port);
    this.transport = transport;
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
    SafeNioTlsWebSocketMessageChannel created =
        new SafeNioTlsWebSocketMessageChannel(sipStack, nioTcpMessageProcessor, client);
    nioHandler.putMessageChannel(client, created);
    return created;
  }

  @Override
  public synchronized MessageChannel createMessageChannel(HostPort targetHostPort) throws IOException {
    String key = MessageChannel.getKey(targetHostPort, transport);
    MessageChannel existing = messageChannels.get(key);
    if (existing != null) {
      return existing;
    }
    // A WebSocket client cannot accept a new connection: send on the one it
    // opened to the sibling listening point, if any (see SiblingChannels).
    MessageChannel sibling = SiblingChannels.find(this, sipStack,
        targetHostPort.getInetAddress(), targetHostPort.getPort(), "WS", "WSS");
    if (sibling != null) {
      return sibling;
    }
    SafeNioTlsWebSocketMessageChannel retval = new SafeNioTlsWebSocketMessageChannel(
        targetHostPort.getInetAddress(), targetHostPort.getPort(), sipStack, this);
    synchronized (messageChannels) {
      messageChannels.put(key, retval);
    }
    retval.markCached();
    selector.wakeup();
    return retval;
  }

  @Override
  public synchronized MessageChannel createMessageChannel(InetAddress targetHost, int port) throws IOException {
    String key = MessageChannel.getKey(targetHost, port, transport);
    MessageChannel existing = messageChannels.get(key);
    if (existing != null) {
      return existing;
    }
    MessageChannel sibling = SiblingChannels.find(this, sipStack, targetHost, port, "WS", "WSS");
    if (sibling != null) {
      return sibling;
    }
    SafeNioTlsWebSocketMessageChannel retval =
        new SafeNioTlsWebSocketMessageChannel(targetHost, port, sipStack, this);
    selector.wakeup();
    messageChannels.put(key, retval);
    retval.markCached();
    return retval;
  }
}

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
import gov.nist.javax.sip.stack.NioWebSocketMessageProcessor;
import gov.nist.javax.sip.stack.SIPTransactionStack;

import java.io.IOException;
import java.net.InetAddress;
import java.nio.channels.SocketChannel;

/**
 * Plain WS message processor that sends on its WSS sibling's connection to a
 * peer instead of opening a new one (see {@link SiblingChannels}), and that
 * accepts connections with {@link SafeNioWebSocketMessageChannel} so the
 * upgrade works whatever the case of the request's header names.
 */
public class SafeNioWebSocketMessageProcessor extends NioWebSocketMessageProcessor
    implements SiblingChannels.Cache {

  public SafeNioWebSocketMessageProcessor(InetAddress ipAddress,
      SIPTransactionStack sipStack, int port) {
    super(ipAddress, sipStack, port);
  }

  @Override
  public MessageChannel findOpenChannel(InetAddress peerAddress, int peerPort) {
    return SiblingChannels.findOpen(messageChannels,
        MessageChannel.getKey(peerAddress, peerPort, transport));
  }

  /**
   * Mirrors the stock implementation but instantiates our channel. Outgoing
   * channels still come from JAIN-SIP's package-private
   * {@code constructMessageChannel}; they read a 101 response, not a request,
   * so the header case does not matter there.
   */
  @Override
  public NioTcpMessageChannel createMessageChannel(
      NioTcpMessageProcessor nioTcpMessageProcessor,
      SocketChannel client) throws IOException {
    NioTcpMessageChannel cached = nioHandler.getMessageChannel(client);
    if (cached != null) {
      return cached;
    }
    SafeNioWebSocketMessageChannel created =
        new SafeNioWebSocketMessageChannel(sipStack, nioTcpMessageProcessor, client);
    nioHandler.putMessageChannel(client, created);
    return created;
  }

  @Override
  public MessageChannel createMessageChannel(HostPort targetHostPort) throws IOException {
    return createMessageChannel(targetHostPort.getInetAddress(), targetHostPort.getPort());
  }

  @Override
  public MessageChannel createMessageChannel(InetAddress targetHost, int port) throws IOException {
    if (messageChannels.get(MessageChannel.getKey(targetHost, port, transport)) == null) {
      MessageChannel sibling = SiblingChannels.find(this, sipStack, targetHost, port, "WS", "WSS");
      if (sibling != null) {
        return sibling;
      }
    }
    return super.createMessageChannel(targetHost, port);
  }
}

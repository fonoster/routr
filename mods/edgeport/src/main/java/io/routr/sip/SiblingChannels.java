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

import gov.nist.javax.sip.ListeningPointImpl;
import gov.nist.javax.sip.SipStackImpl;
import gov.nist.javax.sip.stack.MessageChannel;
import gov.nist.javax.sip.stack.MessageProcessor;
import gov.nist.javax.sip.stack.NioTcpMessageChannel;
import gov.nist.javax.sip.stack.SIPTransactionStack;

import java.net.InetAddress;
import java.nio.channels.SocketChannel;
import java.util.Iterator;
import java.util.Map;

/**
 * Lets a listening point send on a connection that came in on a sibling one
 * when a proxy in front of Routr terminates TLS.
 *
 * <p>With TLS offloaded (Envoy for Fonoster's browser calls, a cloud load
 * balancer in fonoster/routr#308), a WSS client is connected to the WS
 * listening point and a TLS client to the TCP one. The client still names
 * its own transport (Via, and the Contact Routr rebuilds from it), so
 * requests toward it, such as the BYE when the far end hangs up, pick the
 * WSS or TLS listening point. That one has no channel for the peer and would
 * open a new outbound connection to the client's source port, which never
 * accepts one: the request is lost and the call stays up
 * (fonoster/routr#435). RFC 3261 section 18 and RFC 5626 have requests to
 * such a client reuse the connection it opened.
 */
final class SiblingChannels {

  /** A processor that can hand out the open channel it holds for a peer. */
  interface Cache {
    MessageChannel findOpenChannel(InetAddress peerAddress, int peerPort);
  }

  private SiblingChannels() {
  }

  /** The open channel for {@code key} in a processor's channel table, or null. */
  static MessageChannel findOpen(Map<String, ? extends MessageChannel> channels, String key) {
    MessageChannel channel = channels.get(key);
    if (!(channel instanceof NioTcpMessageChannel)) {
      return null;
    }
    SocketChannel socket = ((NioTcpMessageChannel) channel).getSocketChannel();
    return socket != null && socket.isOpen() && socket.isConnected() ? channel : null;
  }

  /**
   * The open channel to the peer held by another listening point of one of
   * {@code transports}, or null.
   */
  static MessageChannel find(MessageProcessor self, SIPTransactionStack sipStack,
      InetAddress peerAddress, int peerPort, String... transports) {
    if (!(sipStack instanceof SipStackImpl)) {
      return null;
    }
    Iterator<?> listeningPoints = ((SipStackImpl) sipStack).getListeningPoints();
    while (listeningPoints.hasNext()) {
      MessageProcessor processor = ((ListeningPointImpl) listeningPoints.next()).getMessageProcessor();
      if (processor == self || !(processor instanceof Cache) || !isOneOf(processor.getTransport(), transports)) {
        continue;
      }
      MessageChannel channel = ((Cache) processor).findOpenChannel(peerAddress, peerPort);
      if (channel != null) {
        return channel;
      }
    }
    return null;
  }

  private static boolean isOneOf(String transport, String... transports) {
    for (String t : transports) {
      if (t.equalsIgnoreCase(transport)) {
        return true;
      }
    }
    return false;
  }
}

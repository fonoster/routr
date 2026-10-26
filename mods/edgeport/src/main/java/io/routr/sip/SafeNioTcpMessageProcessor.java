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

import gov.nist.javax.sip.stack.MessageChannel;
import gov.nist.javax.sip.stack.NioTcpMessageProcessor;
import gov.nist.javax.sip.stack.SIPTransactionStack;

import java.net.InetAddress;

/**
 * Plain TCP message processor whose connections the TLS listening point can
 * send on when a proxy terminates the client's TLS (see {@link SiblingChannels}).
 * It never borrows the other way: a request that names TCP may dial out.
 */
public class SafeNioTcpMessageProcessor extends NioTcpMessageProcessor
    implements SiblingChannels.Cache {

  public SafeNioTcpMessageProcessor(InetAddress ipAddress,
      SIPTransactionStack sipStack, int port) {
    super(ipAddress, sipStack, port);
  }

  @Override
  public MessageChannel findOpenChannel(InetAddress peerAddress, int peerPort) {
    return SiblingChannels.findOpen(messageChannels,
        MessageChannel.getKey(peerAddress, peerPort, transport));
  }
}

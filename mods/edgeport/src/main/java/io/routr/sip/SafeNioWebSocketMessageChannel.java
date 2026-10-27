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
import gov.nist.javax.sip.stack.NioWebSocketMessageChannel;
import gov.nist.javax.sip.stack.SIPTransactionStack;

import java.io.IOException;
import java.nio.channels.SocketChannel;

/**
 * Plain WS channel that accepts the upgrade request whatever the case of its
 * header names (see {@link WebSocketUpgradeHeaders}).
 */
public class SafeNioWebSocketMessageChannel extends NioWebSocketMessageChannel {

  private final WebSocketUpgradeHeaders upgradeHeaders = new WebSocketUpgradeHeaders();

  protected SafeNioWebSocketMessageChannel(SIPTransactionStack sipStack,
      NioTcpMessageProcessor nioTcpMessageProcessor,
      SocketChannel socketChannel) throws IOException {
    super(sipStack, nioTcpMessageProcessor, socketChannel);
  }

  @Override
  protected void addBytes(byte[] bytes) throws Exception {
    byte[] ready = upgradeHeaders.accept(bytes);
    if (ready != null) {
      super.addBytes(ready);
    }
  }
}

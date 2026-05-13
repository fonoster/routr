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

import gov.nist.javax.sip.stack.NioTlsWebSocketMessageChannel;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.mockito.invocation.Invocation;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.mock;

/**
 * Tests that {@link SafeNioTlsWebSocketMessageChannel} actually breaks the
 * JAIN-SIP 1.3.0-91 onNewSocket -> sendMessage -> sendTCPMessage -> onNewSocket
 * recursion that hangs the EdgePort after a WebRTC peer disconnects.
 *
 * <p>We cannot easily instantiate a real {@link NioTlsWebSocketMessageChannel}
 * here — its constructors require a fully wired SIP stack and SSL context — so
 * the tests use Mockito to construct an instance without invoking constructors
 * and then exercise {@code onNewSocket} via {@code doCallRealMethod()}.
 */
public class SafeNioTlsWebSocketMessageChannelTest {

  /**
   * The core invariant: our override of {@code onNewSocket} must not call
   * {@code sendMessage} (any overload). The recursion in JAIN-SIP 1.3.0-91
   * starts with the protected {@code sendMessage(byte[], boolean)}, which we
   * cannot reference directly from this package — so we inspect the mock's
   * invocation log by method name instead.
   */
  @Test
  public void onNewSocket_doesNotInvokeSendMessage_breaksTheRecursion() {
    SafeNioTlsWebSocketMessageChannel channel = mock(SafeNioTlsWebSocketMessageChannel.class);

    doCallRealMethod().when(channel).onNewSocket(any(byte[].class));

    // Run the actual override on a stale buffered message. Must return cleanly
    // (no StackOverflowError, no exception bubbling up).
    channel.onNewSocket(new byte[] { 0x01, 0x02, 0x03 });

    assertNoSendMessageInvocation(channel);
  }

  /**
   * Sanity check: a {@code null} message buffer must not blow up either. The
   * stock implementation guards against null only after a debug log path, but
   * we never read past the length check in our override.
   */
  @Test
  public void onNewSocket_acceptsNullMessageWithoutThrowing() {
    SafeNioTlsWebSocketMessageChannel channel = mock(SafeNioTlsWebSocketMessageChannel.class);

    doCallRealMethod().when(channel).onNewSocket(any());

    channel.onNewSocket(null);

    assertNoSendMessageInvocation(channel);
  }

  private static void assertNoSendMessageInvocation(Object mockChannel) {
    for (Invocation invocation : Mockito.mockingDetails(mockChannel).getInvocations()) {
      String name = invocation.getMethod().getName();
      assertFalse(name.equals("sendMessage"),
          "onNewSocket must not call sendMessage on the channel; recursion was " +
          "the entire cause of the EdgePort hang. Got invocation: " + invocation);
    }
  }

  /**
   * Guards against accidentally dropping the override during a future refactor.
   * If someone removes our {@code onNewSocket} the parent's buggy version
   * would silently take over again.
   */
  @Test
  public void onNewSocket_isDeclaredOnSafeSubclass_notInherited() throws NoSuchMethodException {
    Method ours = SafeNioTlsWebSocketMessageChannel.class
        .getDeclaredMethod("onNewSocket", byte[].class);
    Method parents = NioTlsWebSocketMessageChannel.class
        .getDeclaredMethod("onNewSocket", byte[].class);

    assertNotNull(ours, "Safe subclass must declare its own onNewSocket override");
    assertEquals(SafeNioTlsWebSocketMessageChannel.class, ours.getDeclaringClass(),
        "onNewSocket must be declared on SafeNioTlsWebSocketMessageChannel");
    assertNotEquals(parents, ours,
        "Safe override must be a different method than the parent's");
  }

  /**
   * Class-hierarchy sanity: ensures the safe channel is still recognised by
   * JAIN-SIP as a {@link NioTlsWebSocketMessageChannel}, otherwise the stock
   * processor's casts would fail.
   */
  @Test
  public void safeChannel_isASubclassOfStockChannel() {
    assertTrue(NioTlsWebSocketMessageChannel.class
        .isAssignableFrom(SafeNioTlsWebSocketMessageChannel.class));
  }
}

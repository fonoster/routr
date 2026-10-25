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

import org.junit.jupiter.api.Test;

import javax.net.ssl.SSLEngine;
import javax.net.ssl.SSLEngineResult.HandshakeStatus;
import java.lang.reflect.InvocationTargetException;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class SafeNioTlsMessageChannelTest {

  private SSLEngine engineIn(HandshakeStatus status) {
    var engine = mock(SSLEngine.class);
    when(engine.getHandshakeStatus()).thenReturn(status);
    return engine;
  }

  @Test
  public void sendsThePendingHandshakeUnderTheWrapLock() {
    var lock = new Object();
    var heldLock = new AtomicBoolean();

    var sent = SafeNioTlsMessageChannel.sendPendingHandshake(
        engineIn(HandshakeStatus.NEED_WRAP), lock, () -> {
          heldLock.set(Thread.holdsLock(lock));
          return null;
        }, "peer");

    assertTrue(sent);
    assertTrue(heldLock.get(), "the handshake records must be produced under the wrap lock");
  }

  @Test
  public void doesNothingWhenNoHandshakeMessageIsDue() {
    var ran = new AtomicBoolean();

    var sent = SafeNioTlsMessageChannel.sendPendingHandshake(
        engineIn(HandshakeStatus.NOT_HANDSHAKING), new Object(), () -> {
          ran.set(true);
          return null;
        }, "peer");

    assertFalse(sent);
    assertFalse(ran.get());
  }

  @Test
  public void logsInsteadOfThrowingWhenTheSendFails() {
    // The reflective call wraps the engine's error; it must not escape and end
    // the connection's read path
    var sent = SafeNioTlsMessageChannel.sendPendingHandshake(
        engineIn(HandshakeStatus.NEED_WRAP), new Object(), () -> {
          throw new InvocationTargetException(new IllegalStateException("engine closed"));
        }, "peer");

    assertFalse(sent);
  }

  @Test
  public void doesNothingWithoutAnEngineOrALock() {
    assertFalse(SafeNioTlsMessageChannel.sendPendingHandshake(null, new Object(), () -> null, "peer"));
    assertFalse(SafeNioTlsMessageChannel.sendPendingHandshake(
        engineIn(HandshakeStatus.NEED_WRAP), null, () -> null, "peer"));
  }
}

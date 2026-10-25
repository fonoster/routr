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

import gov.nist.javax.sip.SipStackImpl;
import gov.nist.javax.sip.stack.NioTcpMessageProcessor;
import gov.nist.javax.sip.stack.NioTlsMessageChannel;
import gov.nist.javax.sip.stack.NioTlsMessageProcessor;
import gov.nist.javax.sip.stack.SIPTransactionStack;
import gov.nist.javax.sip.stack.SSLStateMachine;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.net.ssl.KeyManager;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLEngine;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.IOException;
import java.lang.reflect.Field;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.ServerSocketChannel;
import java.nio.channels.SocketChannel;
import java.security.cert.X509Certificate;
import java.util.List;
import java.util.Properties;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * Reproduces the JAIN-SIP 1.3.0-91 bug that keeps the EdgePort from calling a
 * carrier over TLS, and checks that {@link SafeNioTlsMessageChannel} fixes it.
 *
 * <p>Everything here is the real stack: the real {@code NIOHandler} with its
 * socket table, the real non-blocking connect, the real
 * {@code NioTcpMessageChannel.sendTCPMessage} and the stock
 * {@code NioTlsMessageChannel.onNewSocket}. A local server accepts the
 * connections the stack opens and counts them. The one concession is the SSL
 * pipeline: {@code init} installs a stub state machine and {@code sendMessage}
 * goes straight to {@code sendTCPMessage}, which is what the wrap callback does
 * in production once the engine has produced bytes.
 *
 * <p>Stock behavior: the first send opens a socket, the socket table drops it
 * at once (non-blocking connects never count as "connected" in
 * {@code openOutgoingConnection}), {@code sendTCPMessage} sees a new socket and
 * calls {@code onNewSocket}, which resends, which opens another socket, and so
 * on until the stack overflows. The counters below track that independently of
 * whether the JVM lets the {@code StackOverflowError} escape.
 */
public class TlsClientRecursionReproductionIntegrationTest {

  private static class TestStockChannel extends NioTlsMessageChannel {
    final AtomicInteger onNewSocketCalls = new AtomicInteger();

    TestStockChannel(InetAddress address, int port, SIPTransactionStack stack,
        NioTcpMessageProcessor processor) throws IOException {
      super(address, port, stack, processor);
    }

    @Override
    public void init(boolean clientMode) {
      installStubSslStateMachine(this, clientMode);
    }

    @Override
    protected void sendMessage(byte[] message, boolean isClient) throws IOException {
      sendTCPMessage(message, peerAddress, peerPort, isClient);
    }

    @Override
    public void onNewSocket(byte[] message) {
      onNewSocketCalls.incrementAndGet();
      super.onNewSocket(message);
    }

    void send(byte[] message) throws IOException {
      sendTCPMessage(message, peerAddress, peerPort, false);
    }
  }

  private static class TestSafeChannel extends SafeNioTlsMessageChannel {
    final AtomicInteger onNewSocketCalls = new AtomicInteger();

    TestSafeChannel(InetAddress address, int port, SIPTransactionStack stack,
        NioTcpMessageProcessor processor) throws IOException {
      super(address, port, stack, processor);
    }

    @Override
    public void init(boolean clientMode) {
      installStubSslStateMachine(this, clientMode);
    }

    @Override
    protected void sendMessage(byte[] message, boolean isClient) throws IOException {
      sendTCPMessage(message, peerAddress, peerPort, isClient);
    }

    @Override
    public void onNewSocket(byte[] message) {
      onNewSocketCalls.incrementAndGet();
      super.onNewSocket(message);
    }

    void send(byte[] message) throws IOException {
      sendTCPMessage(message, peerAddress, peerPort, false);
    }
  }

  /** A carrier stand-in: accepts every connection and records what arrives. */
  private static class CountingServer implements Runnable {
    final ServerSocketChannel server;
    final List<SocketChannel> accepted = new CopyOnWriteArrayList<>();
    final AtomicReference<byte[]> received = new AtomicReference<>();
    volatile boolean running = true;

    CountingServer() throws IOException {
      server = ServerSocketChannel.open();
      server.bind(new InetSocketAddress("127.0.0.1", 0), 1024);
      server.configureBlocking(false);
    }

    int port() throws IOException {
      return ((InetSocketAddress) server.getLocalAddress()).getPort();
    }

    @Override
    public void run() {
      ByteBuffer buffer = ByteBuffer.allocate(4096);
      while (running) {
        try {
          SocketChannel client = server.accept();
          if (client != null) {
            client.configureBlocking(false);
            accepted.add(client);
          }
          for (SocketChannel sc : accepted) {
            buffer.clear();
            int n = sc.isOpen() ? sc.read(buffer) : -1;
            if (n > 0) {
              byte[] bytes = new byte[n];
              buffer.flip();
              buffer.get(bytes);
              received.compareAndSet(null, bytes);
            }
          }
          Thread.sleep(5);
        } catch (Exception ignored) {
          // closed sockets and interrupts end the loop on the next check
        }
      }
    }

    void close() {
      running = false;
      for (SocketChannel sc : accepted) {
        try { sc.close(); } catch (Exception ignored) {}
      }
      try { server.close(); } catch (Exception ignored) {}
    }
  }

  private SipStackImpl sipStack;
  private CountingServer carrier;
  private Thread carrierThread;
  private NioTcpMessageProcessor processor;

  @BeforeEach
  void setUp() throws Exception {
    Properties props = new Properties();
    props.setProperty("javax.sip.STACK_NAME", "tls-client-repro-" + System.nanoTime());
    props.setProperty("gov.nist.javax.sip.LOG_MESSAGE_CONTENT", "false");
    props.setProperty("gov.nist.javax.sip.TRACE_LEVEL", "0");
    // The EdgePort runs non-blocking; that is the mode with the bug
    props.setProperty("gov.nist.javax.sip.NIO_BLOCKING_MODE", "NONBLOCKING");
    sipStack = new SipStackImpl(props);

    carrier = new CountingServer();
    carrierThread = new Thread(carrier, "tls-repro-carrier");
    carrierThread.setDaemon(true);
    carrierThread.start();
  }

  @AfterEach
  void tearDown() {
    if (processor != null) {
      try { processor.stop(); } catch (Exception ignored) {}
    }
    if (carrier != null) {
      carrier.close();
    }
    if (sipStack != null) {
      try { sipStack.stop(); } catch (Exception ignored) {}
    }
  }

  @Test
  public void stockChannel_firstSendToACarrier_recursesThroughOnNewSocket() throws Exception {
    processor = new NioTlsMessageProcessor(InetAddress.getByName("127.0.0.1"), sipStack, 0);
    processor.start();

    TestStockChannel channel = new TestStockChannel(
        InetAddress.getByName("127.0.0.1"), carrier.port(), sipStack, processor);

    Throwable thrown = runWithBoundedStack(() -> channel.send(clientHello()));

    System.err.println("[stockChannel_firstSendToACarrier_recursesThroughOnNewSocket] thrown=" + thrown
        + " onNewSocketCalls=" + channel.onNewSocketCalls.get()
        + " connections=" + carrier.accepted.size());

    assertTrue(channel.onNewSocketCalls.get() > 50,
        "the stock channel must recurse through onNewSocket on the first send; observed only "
            + channel.onNewSocketCalls.get());
    if (thrown != null) {
      assertTrue(thrown instanceof StackOverflowError,
          "whatever escapes the stock recursion is the production StackOverflowError; got " + thrown);
    }
  }

  @Test
  public void safeChannel_firstSendToACarrier_usesOneConnectionAndQueuesTheBytes() throws Exception {
    processor = new SafeNioTlsMessageProcessor(InetAddress.getByName("127.0.0.1"), sipStack, 0);
    processor.start();

    TestSafeChannel channel = new TestSafeChannel(
        InetAddress.getByName("127.0.0.1"), carrier.port(), sipStack, processor);

    byte[] hello = clientHello();
    Throwable thrown = runWithBoundedStack(() -> channel.send(hello));

    // Give the selector thread time to finish the connect and flush the queue
    long deadline = System.currentTimeMillis() + 5_000;
    while (carrier.received.get() == null && System.currentTimeMillis() < deadline) {
      Thread.sleep(20);
    }

    System.err.println("[safeChannel_firstSendToACarrier_usesOneConnectionAndQueuesTheBytes] thrown=" + thrown
        + " onNewSocketCalls=" + channel.onNewSocketCalls.get()
        + " connections=" + carrier.accepted.size());

    if (thrown != null) {
      fail("the safe channel must not throw on the first send; got " + thrown);
    }
    // The constructor's connection is registered, so the first send reuses it:
    // no socket swap, no onNewSocket, one connection to the carrier.
    assertEquals(0, channel.onNewSocketCalls.get(),
        "the first send must reuse the constructor's connection, not swap sockets");
    assertEquals(1, carrier.accepted.size(),
        "the safe channel must open exactly one connection to the carrier; opened "
            + carrier.accepted.size());
    assertTrue(carrier.received.get() != null && carrier.received.get().length == hello.length,
        "the bytes of the first send must reach the carrier on that connection");
  }

  // --------- helpers ---------

  /** The first bytes of a TLS ClientHello: a record header and a handshake type. */
  private static byte[] clientHello() {
    return new byte[] { 0x16, 0x03, 0x01, 0x00, 0x05, 0x01, 0x00, 0x00, 0x01, 0x00 };
  }

  private static Throwable runWithBoundedStack(ThrowingRunnable body) throws InterruptedException {
    AtomicReference<Throwable> caught = new AtomicReference<>();
    Thread t = new Thread(null, () -> {
      try {
        body.run();
      } catch (Throwable err) {
        caught.set(err);
      }
    }, "tls-recursion-test", 256L * 1024L);
    t.setUncaughtExceptionHandler((thread, err) -> caught.compareAndSet(null, err));
    t.setDaemon(true);
    t.start();
    t.join(15_000);
    if (t.isAlive()) {
      t.interrupt();
      fail("the send did not return within 15 seconds");
    }
    return caught.get();
  }

  @FunctionalInterface
  private interface ThrowingRunnable {
    void run() throws Exception;
  }

  /**
   * Gives the channel an {@link SSLStateMachine} with a real engine so
   * {@code createBuffers()} can read the session buffer sizes, without a
   * keystore on the processor. Nothing is ever encrypted in this test.
   */
  private static void installStubSslStateMachine(NioTlsMessageChannel channel, boolean clientMode) {
    try {
      SSLContext ctx = SSLContext.getInstance("TLS");
      ctx.init(new KeyManager[0], new TrustManager[] { trustAll() }, null);
      SSLEngine engine = ctx.createSSLEngine();
      engine.setUseClientMode(clientMode);

      Field stateMachineField = NioTlsMessageChannel.class.getDeclaredField("sslStateMachine");
      stateMachineField.setAccessible(true);
      stateMachineField.set(channel, new SSLStateMachine(engine, channel));
    } catch (Exception e) {
      throw new RuntimeException("test SSL stub failed", e);
    }
  }

  private static TrustManager trustAll() {
    return new X509TrustManager() {
      @Override public void checkClientTrusted(X509Certificate[] chain, String authType) {}
      @Override public void checkServerTrusted(X509Certificate[] chain, String authType) {}
      @Override public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
    };
  }
}

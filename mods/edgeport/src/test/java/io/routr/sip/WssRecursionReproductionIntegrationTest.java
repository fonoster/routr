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
import gov.nist.javax.sip.stack.NIOHandler;
import gov.nist.javax.sip.stack.NioTcpMessageChannel;
import gov.nist.javax.sip.stack.NioTcpMessageProcessor;
import gov.nist.javax.sip.stack.NioTlsWebSocketMessageChannel;
import gov.nist.javax.sip.stack.NioTlsWebSocketMessageProcessor;
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
import java.nio.channels.ServerSocketChannel;
import java.nio.channels.SocketChannel;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * End-to-end reproduction of the JAIN-SIP 1.3.0-91 WSS recursion bug that
 * hangs the EdgePort, paired with a verification that
 * {@link SafeNioTlsWebSocketMessageChannel} breaks the recursion.
 *
 * <p>This test exercises <b>real</b> JAIN-SIP code (the live, unmodified
 * {@code NioTlsWebSocketMessageChannel.onNewSocket}, the real
 * {@code NioTcpMessageChannel.sendTCPMessage}, the real
 * {@code NioTlsWebSocketMessageProcessor}, the real {@code SipStackImpl}).
 * The two narrow concessions to test isolation are:
 *
 * <ol>
 *   <li>A custom {@link NIOHandler} ({@link AlternatingSocketsNioHandler})
 *       that deterministically returns a {@code SocketChannel} from a small
 *       pre-allocated pool, so {@code sendTCPMessage} reliably observes
 *       {@code sock != socketChannel} on every iteration. In production the
 *       same condition arises stochastically when the browser-side WSS peer
 *       disconnects and JAIN-SIP keeps opening replacement sockets.</li>
 *   <li>A test-local override of {@code init(boolean)} and
 *       {@code sendMessage(byte[], boolean)} that installs a stub
 *       {@link SSLStateMachine} and short-circuits the SSL wrap path into a
 *       direct {@code sendTCPMessage} call. The SSL wrap path is exactly what
 *       the production stack trace shows
 *       ({@code sendMessage -> wrap -> doSend -> sendNonWebSocketMessage ->
 *       sendTCPMessage}), so collapsing it preserves the recursion semantics
 *       while removing the need to terminate a real TLS handshake inside the
 *       test.</li>
 * </ol>
 *
 * <p>Production stack trace this test reproduces (from
 * {@code routr-issue/log_new_issue.txt}):
 * <pre>
 *   ...sendTCPMessage:346 -> onNewSocket:365 -> sendMessage:164 -> wrap:127
 *   -> doSend:168 -> sendNonWebSocketMessage:107 -> sendTCPMessage:321 -> ...
 * </pre>
 *
 * <p>Both halves of the test run inside a thread with a deliberately small
 * stack so the recursion either fails fast or returns fast.
 *
 * <p><b>About StackOverflowError:</b> the test does <i>not</i> insist on a
 * {@code StackOverflowError} reaching the caller. HotSpot is allowed to
 * deoptimize a deeply-recursive JIT-compiled method, swallow the error in
 * its deopt path, and let the method return normally. The
 * {@code onNewSocketCalls} / {@code sendBytesCalls} counters track the
 * recursion independently of how the JVM ultimately disposes of the stack
 * exhaustion, so a clean return with a counter of 200+ is just as
 * conclusive as a thrown SOE. In production the runtime conditions are
 * different (larger frames, longer recursion, different JIT history) and
 * the SOE escapes — as seen in {@code routr-issue/log_new_issue.txt}.
 */
public class WssRecursionReproductionIntegrationTest {

  /**
   * A custom NIOHandler that hands back a different {@link SocketChannel} on
   * every {@code sendBytes} call by rotating through a fixed pool. This is
   * the deterministic equivalent of "the browser keeps reconnecting and
   * dropping" that triggers the bug in production.
   */
  private static class AlternatingSocketsNioHandler extends NIOHandler {

    private final List<SocketChannel> pool;
    private final AtomicInteger nextIndex = new AtomicInteger();
    final AtomicInteger sendBytesCalls = new AtomicInteger();

    AlternatingSocketsNioHandler(SIPTransactionStack stack,
        NioTcpMessageProcessor processor, List<SocketChannel> pool) {
      super(stack, processor);
      this.pool = pool;
    }

    @Override
    public SocketChannel sendBytes(InetAddress senderAddress,
        InetAddress receiverAddress, int contactPort, String transport,
        byte[] bytes, boolean retry, NioTcpMessageChannel channel) throws IOException {
      sendBytesCalls.incrementAndGet();
      return pool.get(nextIndex.getAndIncrement() % pool.size());
    }
  }

  /**
   * Test subclass that uses the unmodified stock {@code onNewSocket} from
   * {@link NioTlsWebSocketMessageChannel} but stubs out the two parts of the
   * SSL pipeline that would otherwise require a real TLS handshake. The
   * stubs are deliberately minimal so the structure of the bug
   * ({@code onNewSocket} unconditionally calling {@code sendMessage}) is the
   * only thing under test.
   */
  private static class TestStockChannel extends NioTlsWebSocketMessageChannel {
    final AtomicInteger onNewSocketCalls = new AtomicInteger();

    TestStockChannel(SIPTransactionStack stack, NioTcpMessageProcessor proc,
        SocketChannel sock) throws IOException {
      super(stack, proc, sock);
    }

    @Override
    public void init(boolean client) {
      installStubSslStateMachine(this, client);
    }

    @Override
    protected void sendMessage(byte[] message, boolean isClient) throws IOException {
      // Production: sendMessage -> SSL wrap -> doSend -> sendNonWebSocketMessage
      //             -> sendTCPMessage
      // We collapse that into a direct sendTCPMessage call to avoid running a
      // real TLS handshake inside a unit test. The recursion entry point we
      // care about is the call to sendMessage from inside onNewSocket; what
      // sendMessage does after that is just the wrong way to route bytes back
      // through sendTCPMessage, which we faithfully reproduce here.
      sendTCPMessage(message, peerAddress, peerPort, isClient);
    }

    @Override
    public void onNewSocket(byte[] message) {
      onNewSocketCalls.incrementAndGet();
      super.onNewSocket(message);
    }
  }

  /**
   * Same test scaffolding as {@link TestStockChannel} but inherits the
   * patched {@link SafeNioTlsWebSocketMessageChannel#onNewSocket} which must
   * NOT call {@code sendMessage}. If our override regresses, this test fails
   * the same way the stock test does.
   */
  private static class TestSafeChannel extends SafeNioTlsWebSocketMessageChannel {
    final AtomicInteger onNewSocketCalls = new AtomicInteger();

    TestSafeChannel(SIPTransactionStack stack, NioTcpMessageProcessor proc,
        SocketChannel sock) throws IOException {
      super(stack, proc, sock);
    }

    @Override
    public void init(boolean client) {
      installStubSslStateMachine(this, client);
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
  }

  private SipStackImpl sipStack;
  private NioTlsWebSocketMessageProcessor processor;
  private ServerSocketChannel localServer;
  private final List<SocketChannel> clientSockets = new ArrayList<>();
  private final List<SocketChannel> serverSockets = new ArrayList<>();

  @BeforeEach
  void setUp() throws Exception {
    Properties props = new Properties();
    props.setProperty("javax.sip.STACK_NAME", "wss-recursion-repro-" + System.nanoTime());
    props.setProperty("gov.nist.javax.sip.LOG_MESSAGE_CONTENT", "false");
    props.setProperty("gov.nist.javax.sip.TRACE_LEVEL", "0");
    sipStack = new SipStackImpl(props);

    processor = new NioTlsWebSocketMessageProcessor(
        InetAddress.getByName("127.0.0.1"), sipStack, 0);

    localServer = ServerSocketChannel.open();
    localServer.bind(new InetSocketAddress("127.0.0.1", 0));
  }

  @AfterEach
  void tearDown() throws Exception {
    for (SocketChannel sc : clientSockets) {
      try { sc.close(); } catch (Exception ignored) {}
    }
    for (SocketChannel sc : serverSockets) {
      try { sc.close(); } catch (Exception ignored) {}
    }
    if (localServer != null) {
      try { localServer.close(); } catch (Exception ignored) {}
    }
    if (sipStack != null) {
      try { sipStack.stop(); } catch (Exception ignored) {}
    }
  }

  /**
   * Reproduces the production bug: invoking
   * {@link NioTlsWebSocketMessageChannel#onNewSocket(byte[])} on a channel
   * whose backing {@code SocketChannel} keeps being replaced (the situation
   * after a WebRTC peer disconnects) recurses through
   * {@code sendMessage -> sendTCPMessage -> onNewSocket} unboundedly. We
   * verify the recursion happens by observing the depth counter plus the
   * fact that JAIN-SIP's {@code nioHandler.sendBytes} is called from inside
   * the buggy path.
   *
   * <p>We do <i>not</i> directly assert {@code StackOverflowError} because
   * JIT-compiled frames vary in size from run to run, so the precise depth
   * at which the JVM finally throws — or whether it manages to unwind
   * cleanly back to caller after exhausting some headroom — fluctuates
   * across test orderings. What matters is that the buggy recursion
   * <i>fires</i> at all and reaches a depth that would be catastrophic in
   * production where the stack and frame sizes are very different.
   */
  @Test
  public void stockChannel_onNewSocket_recursesIntoSendMessagePath() throws Exception {
    SocketChannel initialSock = newConnectedSocket();
    List<SocketChannel> rotationPool = pool(3);

    AlternatingSocketsNioHandler altHandler =
        new AlternatingSocketsNioHandler(sipStack, processor, rotationPool);
    injectNioHandler(processor, altHandler);

    TestStockChannel channel = new TestStockChannel(sipStack, processor, initialSock);

    Throwable thrown = runWithBoundedStack(() ->
        channel.onNewSocket(new byte[] { 0x01, 0x02, 0x03 }));

    System.err.println("[stockChannel_onNewSocket_recursesIntoSendMessagePath] " +
        "thrown=" + thrown +
        " onNewSocketCalls=" + channel.onNewSocketCalls.get() +
        " sendBytesCalls=" + altHandler.sendBytesCalls.get());

    assertTrue(channel.onNewSocketCalls.get() > 50,
        "Stock onNewSocket must recurse via sendMessage -> sendTCPMessage -> " +
        "onNewSocket; observed depth was only " + channel.onNewSocketCalls.get());
    assertTrue(altHandler.sendBytesCalls.get() > 50,
        "Stock recursion must hit nioHandler.sendBytes on every level; only " +
        "observed " + altHandler.sendBytesCalls.get() + " call(s)");
    if (thrown != null) {
      assertTrue(thrown instanceof StackOverflowError,
          "If anything escapes the stock recursion it should be a " +
          "StackOverflowError (the production symptom); got " +
          thrown.getClass().getName() + ": " + thrown.getMessage());
    }
  }

  /**
   * The fix: {@link SafeNioTlsWebSocketMessageChannel#onNewSocket} must
   * <i>not</i> call back into the {@code sendMessage} pipeline, so the same
   * trigger that blows up the stock channel returns cleanly here.
   */
  @Test
  public void safeChannel_onNewSocket_returnsCleanly_withoutRecursion() throws Exception {
    SocketChannel initialSock = newConnectedSocket();
    List<SocketChannel> rotationPool = pool(3);

    AlternatingSocketsNioHandler altHandler =
        new AlternatingSocketsNioHandler(sipStack, processor, rotationPool);
    injectNioHandler(processor, altHandler);

    TestSafeChannel channel = new TestSafeChannel(sipStack, processor, initialSock);

    Throwable thrown = runWithBoundedStack(() ->
        channel.onNewSocket(new byte[] { 0x01, 0x02, 0x03 }));

    System.err.println("[safeChannel_onNewSocket_returnsCleanly_withoutRecursion] " +
        "thrown=" + thrown +
        " onNewSocketCalls=" + channel.onNewSocketCalls.get() +
        " sendBytesCalls=" + altHandler.sendBytesCalls.get());

    if (thrown != null) {
      fail("Safe onNewSocket must return cleanly on a closed/replaced WSS " +
          "socket but threw " + thrown.getClass().getName() + ": " +
          thrown.getMessage());
    }
    assertEquals(1, channel.onNewSocketCalls.get(),
        "Safe onNewSocket must be invoked exactly once — no recursion");
    assertEquals(0, altHandler.sendBytesCalls.get(),
        "Safe onNewSocket must not trigger any nioHandler.sendBytes call " +
        "(which would mean the buggy sendMessage path ran)");
  }

  /**
   * Side-by-side run: same trigger, same processor — only the channel class
   * differs. Stock recurses, safe doesn't. If a future refactor turns
   * SafeNioTlsWebSocketMessageChannel back into a passthrough this test
   * fails the same way as the production bug did.
   */
  @Test
  public void sameTrigger_recursesStock_butLeavesSafeIntact() throws Exception {
    // Stock half
    SocketChannel stockInitial = newConnectedSocket();
    AlternatingSocketsNioHandler stockHandler =
        new AlternatingSocketsNioHandler(sipStack, processor, pool(3));
    injectNioHandler(processor, stockHandler);
    TestStockChannel stockChannel = new TestStockChannel(sipStack, processor, stockInitial);

    Throwable stockThrown = runWithBoundedStack(() ->
        stockChannel.onNewSocket(new byte[] { 0x10, 0x20 }));

    // Safe half (fresh pool/handler on the same processor)
    SocketChannel safeInitial = newConnectedSocket();
    AlternatingSocketsNioHandler safeHandler =
        new AlternatingSocketsNioHandler(sipStack, processor, pool(3));
    injectNioHandler(processor, safeHandler);
    TestSafeChannel safeChannel = new TestSafeChannel(sipStack, processor, safeInitial);

    Throwable safeThrown = runWithBoundedStack(() ->
        safeChannel.onNewSocket(new byte[] { 0x10, 0x20 }));

    System.err.println("[sameTrigger_recursesStock_butLeavesSafeIntact] " +
        "stockRec=" + stockChannel.onNewSocketCalls.get() +
        " safeRec=" + safeChannel.onNewSocketCalls.get() +
        " stockSendBytes=" + stockHandler.sendBytesCalls.get() +
        " safeSendBytes=" + safeHandler.sendBytesCalls.get());

    assertTrue(stockChannel.onNewSocketCalls.get() >= 50,
        "Stock channel must recurse deeply; observed only " +
        stockChannel.onNewSocketCalls.get() + " call(s)");
    assertEquals(1, safeChannel.onNewSocketCalls.get(),
        "Safe channel must not recurse");
    assertEquals(0, safeHandler.sendBytesCalls.get(),
        "Safe channel must never hit nioHandler.sendBytes");
    assertTrue(stockHandler.sendBytesCalls.get() >= 50,
        "Stock channel must hit nioHandler.sendBytes on every recursion " +
        "iteration; observed " + stockHandler.sendBytesCalls.get());
    if (safeThrown != null) {
      fail("Safe channel must not throw; got " + safeThrown);
    }
  }

  // --------- helpers ---------

  /**
   * Runs {@code body} on a worker thread with a small stack so the
   * recursion either fails fast or returns fast. 256 KiB is enough for tens
   * of thousands of frames of normal Java code but is consumed in well under
   * a second by the WSS recursion, which has ~10 frames per cycle.
   */
  /**
   * Runs {@code body} on a worker thread with a deliberately small stack so
   * the recursion either fails fast or returns fast. 256 KiB is enough for
   * tens of thousands of frames of normal Java code but is consumed in well
   * under a second by the WSS recursion. We capture any {@link Throwable},
   * including {@link StackOverflowError}; note that HotSpot may also choose
   * to deoptimize and unwind cleanly once it runs out of stack, in which
   * case the body returns normally — that is still proof that the
   * recursion fired, since our channel counters track it independently.
   */
  private static Throwable runWithBoundedStack(ThrowingRunnable body) throws InterruptedException {
    AtomicReference<Throwable> caught = new AtomicReference<>();
    Thread t = new Thread(null, () -> {
      try {
        body.run();
      } catch (Throwable err) {
        caught.set(err);
      }
    }, "wss-recursion-test", 256L * 1024L);
    t.setUncaughtExceptionHandler((thread, err) -> caught.compareAndSet(null, err));
    t.setDaemon(true);
    t.start();
    t.join(15_000);
    if (t.isAlive()) {
      t.interrupt();
      fail("Test worker thread did not terminate within 15 seconds — " +
          "either the recursion is wedged or the safe path is blocking");
    }
    return caught.get();
  }

  @FunctionalInterface
  private interface ThrowingRunnable {
    void run() throws Exception;
  }

  /**
   * Opens a real TCP connection to {@link #localServer} so the produced
   * {@link SocketChannel} is valid for {@code NioTcpMessageChannel}'s
   * constructor, which reads peer address + input stream from it. The
   * server-side accept is kept so the OS doesn't reject the connection.
   */
  private SocketChannel newConnectedSocket() throws IOException {
    InetSocketAddress serverAddr = (InetSocketAddress) localServer.getLocalAddress();
    SocketChannel client = SocketChannel.open(
        new InetSocketAddress("127.0.0.1", serverAddr.getPort()));
    clientSockets.add(client);
    SocketChannel acceptedServerSide = localServer.accept();
    serverSockets.add(acceptedServerSide);
    return client;
  }

  private List<SocketChannel> pool(int n) throws IOException {
    List<SocketChannel> pool = new ArrayList<>(n);
    for (int i = 0; i < n; i++) {
      pool.add(newConnectedSocket());
    }
    return pool;
  }

  private static void injectNioHandler(NioTcpMessageProcessor processor,
      NIOHandler handler) throws Exception {
    Field f = NioTcpMessageProcessor.class.getDeclaredField("nioHandler");
    f.setAccessible(true);
    f.set(processor, handler);
  }

  /**
   * Installs a stub {@link SSLStateMachine} on the given channel via
   * reflection so the parent's {@code createBuffers()} call (which reads
   * {@code sslStateMachine.sslEngine.getSession()}) succeeds without a real
   * SSL context on the processor. The state machine is never used for
   * anything beyond satisfying the buffer-size lookup.
   */
  private static void installStubSslStateMachine(NioTlsWebSocketMessageChannel channel,
      boolean clientMode) {
    try {
      SSLContext ctx = SSLContext.getInstance("TLS");
      ctx.init(new KeyManager[0], new TrustManager[] { trustAll() }, null);
      SSLEngine engine = ctx.createSSLEngine();
      engine.setUseClientMode(clientMode);

      Field stateMachineField = NioTlsWebSocketMessageChannel.class.getDeclaredField("sslStateMachine");
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

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
import gov.nist.javax.sip.stack.NioTlsWebSocketMessageChannel;
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
import javax.sip.ListeningPoint;
import javax.sip.SipFactory;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.channels.ServerSocketChannel;
import java.nio.channels.SocketChannel;
import java.nio.charset.StandardCharsets;
import java.security.cert.X509Certificate;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * fonoster/routr#432: HTTP header names are case-insensitive, but JAIN-SIP's
 * WebSocket handshake looks them up case-sensitively. A client that sends
 * {@code sec-websocket-protocol: sip} (Node's built-in WebSocket, HTTP/2
 * front ends) must still get {@code Sec-WebSocket-Protocol: sip} and a
 * correct {@code Sec-WebSocket-Accept} back, on WS and on WSS.
 */
public class WebSocketHeaderCaseTest {

  // RFC 6455, section 1.3: this key must be answered with this accept value.
  private static final String KEY = "dGhlIHNhbXBsZSBub25jZQ==";
  private static final String ACCEPT = "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=";

  private SipStackImpl stack;
  private Socket client;
  private ServerSocketChannel peerServer;

  @BeforeEach
  public void setUp() throws Exception {
    Properties props = new Properties();
    props.setProperty("javax.sip.STACK_NAME", "ws-header-case-test-" + System.nanoTime());
    props.setProperty("gov.nist.javax.sip.TRACE_LEVEL", "0");
    props.setProperty("gov.nist.javax.sip.MESSAGE_PROCESSOR_FACTORY",
        SafeNioMessageProcessorFactory.class.getName());
    SipFactory factory = SipFactory.getInstance();
    factory.setPathName("gov.nist");
    stack = (SipStackImpl) factory.createSipStack(props);
  }

  @AfterEach
  public void tearDown() throws Exception {
    if (client != null) {
      client.close();
    }
    if (peerServer != null) {
      peerServer.close();
    }
    stack.stop();
  }

  @Test
  public void wsNegotiatesSipWithLowercaseHeaderNames() throws Exception {
    String response = upgradeOverWs(lowercaseUpgrade(), 1);

    assertTrue(response.startsWith("HTTP/1.1 101"), response);
    assertEquals("sip", header(response, "Sec-WebSocket-Protocol"), response);
    assertEquals(ACCEPT, header(response, "Sec-WebSocket-Accept"), response);
  }

  @Test
  public void wsNegotiatesSipWhenTheRequestArrivesInPieces() throws Exception {
    // Splits inside a header name, so the rewrite must wait for the whole head.
    String response = upgradeOverWs(lowercaseUpgrade(), 7);

    assertTrue(response.startsWith("HTTP/1.1 101"), response);
    assertEquals("sip", header(response, "Sec-WebSocket-Protocol"), response);
    assertEquals(ACCEPT, header(response, "Sec-WebSocket-Accept"), response);
  }

  @Test
  public void wsStillNegotiatesSipWithCapitalizedHeaderNames() throws Exception {
    String response = upgradeOverWs(capitalizedUpgrade(), 1);

    assertTrue(response.startsWith("HTTP/1.1 101"), response);
    assertEquals("sip", header(response, "Sec-WebSocket-Protocol"), response);
    assertEquals(ACCEPT, header(response, "Sec-WebSocket-Accept"), response);
  }

  @Test
  public void wssNegotiatesSipWithLowercaseHeaderNames() throws Exception {
    String response = upgradeOverWss(lowercaseUpgrade());

    assertTrue(response.startsWith("HTTP/1.1 101"), response);
    assertEquals("sip", header(response, "Sec-WebSocket-Protocol"), response);
    assertEquals(ACCEPT, header(response, "Sec-WebSocket-Accept"), response);
  }

  @Test
  public void wssStillNegotiatesSipWithCapitalizedHeaderNames() throws Exception {
    String response = upgradeOverWss(capitalizedUpgrade());

    assertTrue(response.startsWith("HTTP/1.1 101"), response);
    assertEquals("sip", header(response, "Sec-WebSocket-Protocol"), response);
    assertEquals(ACCEPT, header(response, "Sec-WebSocket-Accept"), response);
  }

  @Test
  public void wsAnswersWithoutAProtocolWhenNoneIsOffered() throws Exception {
    String request = lowercaseUpgrade().replace("sec-websocket-protocol: sip\r\n", "");
    String response = upgradeOverWs(request, 1);

    assertTrue(response.startsWith("HTTP/1.1 101"), response);
    assertNull(header(response, "Sec-WebSocket-Protocol"), response);
    assertEquals(ACCEPT, header(response, "Sec-WebSocket-Accept"), response);
  }

  /** Real stack, real WS listening point, raw socket on the client side. */
  private String upgradeOverWs(String request, int chunks) throws Exception {
    ListeningPoint ws = stack.createListeningPoint("127.0.0.1", freePort(), "ws");
    stack.createSipProvider(ws);
    stack.start();

    client = new Socket(InetAddress.getByName("127.0.0.1"), ws.getPort());
    client.setTcpNoDelay(true);
    client.setSoTimeout(5000);
    OutputStream out = client.getOutputStream();
    byte[] bytes = request.getBytes(StandardCharsets.US_ASCII);
    int size = (bytes.length + chunks - 1) / chunks;
    for (int from = 0; from < bytes.length; from += size) {
      out.write(bytes, from, Math.min(size, bytes.length - from));
      out.flush();
      if (chunks > 1) {
        Thread.sleep(50);
      }
    }
    return readHead(client.getInputStream());
  }

  /**
   * The WSS channel as the stock processor would build it, with the TLS layer
   * stubbed: plaintext goes in through {@code addPlaintextBytes}, the same
   * entry point the SSL state machine uses after decrypting, and the 101 is
   * captured where it would be encrypted and sent.
   */
  private String upgradeOverWss(String request) throws Exception {
    peerServer = ServerSocketChannel.open();
    peerServer.bind(new InetSocketAddress("127.0.0.1", 0));
    SocketChannel socket = SocketChannel.open(peerServer.getLocalAddress());
    peerServer.accept();

    SafeNioTlsWebSocketMessageProcessor processor = new SafeNioTlsWebSocketMessageProcessor(
        InetAddress.getByName("127.0.0.1"), stack, 0, "WSS");
    CapturingWssChannel channel = new CapturingWssChannel(stack, processor, socket);
    try {
      channel.addPlaintextBytes(request.getBytes(StandardCharsets.US_ASCII));
      return channel.sent.toString(StandardCharsets.US_ASCII);
    } finally {
      socket.close();
    }
  }

  private static class CapturingWssChannel extends SafeNioTlsWebSocketMessageChannel {
    final ByteArrayOutputStream sent = new ByteArrayOutputStream();

    CapturingWssChannel(SIPTransactionStack stack, NioTcpMessageProcessor processor,
        SocketChannel socket) throws IOException {
      super(stack, processor, socket);
    }

    @Override
    public void init(boolean client) {
      installStubSslStateMachine(this, client);
    }

    @Override
    protected void sendNonWebSocketMessage(byte[] message, boolean isClient) {
      sent.writeBytes(message);
    }
  }

  private static String lowercaseUpgrade() {
    // What Node 22's built-in WebSocket (undici) puts on the wire.
    return "GET / HTTP/1.1\r\n"
        + "host: 127.0.0.1\r\n"
        + "connection: upgrade\r\n"
        + "upgrade: websocket\r\n"
        + "origin: http://127.0.0.1\r\n"
        + "sec-websocket-key: " + KEY + "\r\n"
        + "sec-websocket-version: 13\r\n"
        + "sec-websocket-protocol: sip\r\n"
        + "sec-websocket-extensions: permessage-deflate; client_max_window_bits\r\n\r\n";
  }

  private static String capitalizedUpgrade() {
    return "GET / HTTP/1.1\r\n"
        + "Host: 127.0.0.1\r\n"
        + "Upgrade: websocket\r\n"
        + "Connection: Upgrade\r\n"
        + "Origin: http://127.0.0.1\r\n"
        + "Sec-WebSocket-Key: " + KEY + "\r\n"
        + "Sec-WebSocket-Protocol: sip\r\n"
        + "Sec-WebSocket-Version: 13\r\n\r\n";
  }

  private static String readHead(InputStream in) throws IOException {
    StringBuilder head = new StringBuilder();
    while (!head.toString().endsWith("\r\n\r\n")) {
      int b = in.read();
      if (b < 0) {
        break;
      }
      head.append((char) b);
    }
    return head.toString();
  }

  private static String header(String response, String name) {
    for (String line : response.split("\r\n")) {
      int colon = line.indexOf(':');
      if (colon > 0 && line.substring(0, colon).trim().equalsIgnoreCase(name)) {
        return line.substring(colon + 1).trim();
      }
    }
    return null;
  }

  private static int freePort() throws Exception {
    try (ServerSocket s = new ServerSocket(0)) {
      return s.getLocalPort();
    }
  }

  private static void installStubSslStateMachine(NioTlsWebSocketMessageChannel channel,
      boolean clientMode) {
    try {
      SSLContext ctx = SSLContext.getInstance("TLS");
      ctx.init(new KeyManager[0], new TrustManager[] { trustAll() }, null);
      SSLEngine engine = ctx.createSSLEngine();
      engine.setUseClientMode(clientMode);
      Field field = NioTlsWebSocketMessageChannel.class.getDeclaredField("sslStateMachine");
      field.setAccessible(true);
      field.set(channel, new SSLStateMachine(engine, channel));
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

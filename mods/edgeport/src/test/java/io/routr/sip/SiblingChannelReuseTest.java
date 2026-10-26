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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.sip.ListeningPoint;
import javax.sip.SipFactory;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * fonoster/routr#435 and #308: a client whose TLS a proxy terminated is
 * connected to the WS (or TCP) listening point, but requests toward it name
 * WSS (or TLS). That processor must send on the existing connection instead
 * of opening a new one to the client's source port.
 */
public class SiblingChannelReuseTest {

  private SipStackImpl stack;
  private Socket client;

  @BeforeEach
  public void setUp() throws Exception {
    Properties props = new Properties();
    props.setProperty("javax.sip.STACK_NAME", "sibling-reuse-test-" + System.nanoTime());
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
    stack.stop();
  }

  @Test
  public void wssProcessorSendsOnTheBrowsersWsConnection() throws Exception {
    InetAddress localhost = InetAddress.getByName("127.0.0.1");
    ListeningPoint ws = stack.createListeningPoint("127.0.0.1", freePort(), "ws");
    stack.createSipProvider(ws);
    stack.start();
    SafeNioWebSocketMessageProcessor wsProcessor =
        (SafeNioWebSocketMessageProcessor) ((ListeningPointImpl) ws).getMessageProcessor();

    client = new Socket(localhost, ws.getPort());
    upgradeAndRegister(client, ws.getPort());
    int browserPort = client.getLocalPort();

    MessageChannel wsChannel = awaitChannel(wsProcessor, localhost, browserPort);
    assertNotNull(wsChannel, "the WS listening point never cached the browser's connection");

    // Not registered with the stack: only the sibling lookup can find the WS channel.
    SafeNioTlsWebSocketMessageProcessor wssProcessor = (SafeNioTlsWebSocketMessageProcessor)
        new SafeNioMessageProcessorFactory().createMessageProcessor(stack, localhost, 0, "WSS");

    MessageChannel channel = wssProcessor.createMessageChannel(localhost, browserPort);

    assertSame(wsChannel, channel, "WSS must reuse the WS connection; got " + channel);
    assertEquals("WS", channel.getTransport());
  }

  @Test
  public void tlsProcessorSendsOnTheClientsTcpConnection() throws Exception {
    InetAddress localhost = InetAddress.getByName("127.0.0.1");
    ListeningPoint tcp = stack.createListeningPoint("127.0.0.1", freePort(), "tcp");
    stack.createSipProvider(tcp);
    stack.start();
    SafeNioTcpMessageProcessor tcpProcessor =
        (SafeNioTcpMessageProcessor) ((ListeningPointImpl) tcp).getMessageProcessor();

    client = new Socket(localhost, tcp.getPort());
    OutputStream out = client.getOutputStream();
    // A phone behind a TLS-terminating load balancer names TLS in its Via.
    out.write(register("TLS", "tls").getBytes(StandardCharsets.US_ASCII));
    out.flush();
    int clientPort = client.getLocalPort();

    MessageChannel tcpChannel = awaitChannel(tcpProcessor, localhost, clientPort);
    assertNotNull(tcpChannel, "the TCP listening point never cached the client's connection");

    // Not registered with the stack: only the sibling lookup can find the TCP channel.
    SafeNioTlsMessageProcessor tlsProcessor = (SafeNioTlsMessageProcessor)
        new SafeNioMessageProcessorFactory().createMessageProcessor(stack, localhost, 0, "TLS");

    MessageChannel channel = tlsProcessor.createMessageChannel(localhost, clientPort);

    assertSame(tcpChannel, channel, "TLS must reuse the TCP connection; got " + channel);
    assertEquals("TCP", channel.getTransport());
  }

  @Test
  public void tcpProcessorStillDialsOutForTcp() throws Exception {
    InetAddress localhost = InetAddress.getByName("127.0.0.1");
    ListeningPoint tcp = stack.createListeningPoint("127.0.0.1", freePort(), "tcp");
    stack.createSipProvider(tcp);
    stack.start();
    SafeNioTcpMessageProcessor tcpProcessor =
        (SafeNioTcpMessageProcessor) ((ListeningPointImpl) tcp).getMessageProcessor();

    try (ServerSocket carrier = new ServerSocket(0)) {
      MessageChannel channel = tcpProcessor.createMessageChannel(localhost, carrier.getLocalPort());
      assertEquals("TCP", channel.getTransport());
      assertEquals(carrier.getLocalPort(), channel.getPeerPort());
    }
  }

  @Test
  public void factoryReturnsTheSafeTcpProcessorForTcp() throws Exception {
    Object processor = new SafeNioMessageProcessorFactory().createMessageProcessor(
        stack, InetAddress.getByName("127.0.0.1"), 0, "TCP");
    assertTrue(processor instanceof SafeNioTcpMessageProcessor,
        "TCP listening points must use the safe processor; got " + processor.getClass());
  }

  @Test
  public void factoryReturnsTheSafeWsProcessorForWs() throws Exception {
    Object processor = new SafeNioMessageProcessorFactory().createMessageProcessor(
        stack, InetAddress.getByName("127.0.0.1"), 0, "WS");
    assertTrue(processor instanceof SafeNioWebSocketMessageProcessor,
        "WS listening points must use the safe processor; got " + processor.getClass());
  }

  private static MessageChannel awaitChannel(SiblingChannels.Cache processor,
      InetAddress peerAddress, int peerPort) throws InterruptedException {
    MessageChannel channel = null;
    for (int i = 0; i < 50 && channel == null; i++) {
      channel = processor.findOpenChannel(peerAddress, peerPort);
      Thread.sleep(100);
    }
    return channel;
  }

  private static int freePort() throws Exception {
    try (ServerSocket s = new ServerSocket(0)) {
      return s.getLocalPort();
    }
  }

  /** The browser side: a WebSocket upgrade, then a REGISTER in one masked text frame. */
  private static void upgradeAndRegister(Socket socket, int port) throws Exception {
    OutputStream out = socket.getOutputStream();
    InputStream in = socket.getInputStream();
    out.write(("GET / HTTP/1.1\r\n"
        + "Host: 127.0.0.1:" + port + "\r\n"
        + "Upgrade: websocket\r\n"
        + "Connection: Upgrade\r\n"
        + "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
        + "Sec-WebSocket-Protocol: sip\r\n"
        + "Sec-WebSocket-Version: 13\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
    out.flush();
    StringBuilder head = new StringBuilder();
    while (!head.toString().endsWith("\r\n\r\n")) {
      int b = in.read();
      if (b < 0) {
        throw new IllegalStateException("upgrade refused: " + head);
      }
      head.append((char) b);
    }
    assertTrue(head.toString().startsWith("HTTP/1.1 101"), head.toString());

    // sip.js names WSS in its Via even when a proxy delivers it as WS.
    out.write(maskedTextFrame(register("WSS", "ws").getBytes(StandardCharsets.US_ASCII)));
    out.flush();
  }

  private static String register(String viaTransport, String contactTransport) {
    return "REGISTER sip:127.0.0.1 SIP/2.0\r\n"
        + "Via: SIP/2.0/" + viaTransport + " df7jal23ls0d.invalid;branch=z9hG4bK" + System.nanoTime() + "\r\n"
        + "Max-Forwards: 70\r\n"
        + "To: <sip:alice@127.0.0.1>\r\n"
        + "From: <sip:alice@127.0.0.1>;tag=1\r\n"
        + "Call-ID: sibling-reuse-" + System.nanoTime() + "\r\n"
        + "CSeq: 1 REGISTER\r\n"
        + "Contact: <sip:alice@df7jal23ls0d.invalid;transport=" + contactTransport + ">\r\n"
        + "Content-Length: 0\r\n\r\n";
  }

  private static byte[] maskedTextFrame(byte[] payload) {
    byte[] mask = {1, 2, 3, 4};
    int header = payload.length < 126 ? 2 : 4;
    byte[] frame = new byte[header + 4 + payload.length];
    frame[0] = (byte) 0x81;
    if (payload.length < 126) {
      frame[1] = (byte) (0x80 | payload.length);
    } else {
      frame[1] = (byte) (0x80 | 126);
      frame[2] = (byte) (payload.length >> 8);
      frame[3] = (byte) payload.length;
    }
    System.arraycopy(mask, 0, frame, header, 4);
    for (int i = 0; i < payload.length; i++) {
      frame[header + 4 + i] = (byte) (payload[i] ^ mask[i % 4]);
    }
    return frame;
  }
}

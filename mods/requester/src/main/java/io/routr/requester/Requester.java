/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
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
package io.routr.requester;

import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.routr.headers.MessageConverter;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import javax.sip.*;
import javax.sip.header.Header;
import javax.sip.message.MessageFactory;
import java.io.IOException;
import java.text.ParseException;
import java.util.List;
import java.util.Properties;
import java.util.TooManyListenersException;
import java.util.concurrent.TimeUnit;

public class Requester {
  private final static Logger LOG = LogManager.getLogger(Requester.class);
  private final Server server;
  private final RequesterService requesterService;
  private MessageFactory messageFactory;
  private SipProvider sipProvider;

  public Requester(final String proxyAddr, final String bindAddr) {
    this.requesterService = new RequesterService(this);
    server = ServerBuilder.forPort(50072).addService(requesterService).build();
    try {
      this.messageFactory = SipFactory.getInstance().createMessageFactory();
      this.sipProvider = createSipProvider(bindAddr, proxyAddr);
    } catch (PeerUnavailableException | TransportNotSupportedException | ObjectInUseException
             | TransportAlreadySupportedException | InvalidArgumentException e) {
      // TODO Auto-generated catch block
      e.printStackTrace();
    }
  }

  static private Properties createProperties(final String proxyAddr) {
    System.out.println("Creating properties for: " + proxyAddr);
    var properties = new java.util.Properties();
    properties.setProperty("javax.sip.STACK_NAME", "routr-registry");
    properties.setProperty("javax.sip.OUTBOUND_PROXY", proxyAddr);
    properties.setProperty("gov.nist.javax.sip.TRACE_LEVEL", "LOG4J");
    properties.setProperty("gov.nist.javax.sip.DEBUG_LOG", "etc/debug_log.txt");
    properties.setProperty("gov.nist.javax.sip.SERVER_LOG", "etc/server_log.txt");
    // Guard against denial of service attack.
    properties.setProperty("gov.nist.javax.sip.MAX_MESSAGE_SIZE", "1048576");
    // Drop the client connection after we are done with the transaction.
    properties.setProperty("gov.nist.javax.sip.CACHE_CLIENT_CONNECTIONS", "true");
    properties.setProperty(
      "gov.nist.javax.sip.MESSAGE_PROCESSOR_FACTORY",
      "gov.nist.javax.sip.stack.NioMessageProcessorFactory");
    properties.setProperty(
      "gov.nist.javax.sip.PATCH_SIP_WEBSOCKETS_HEADERS",
      "false");
    properties.setProperty("gov.nist.javax.sip.NIO_BLOCKING_MODE", "NONBLOCKING");
    properties.setProperty("gov.nist.javax.sip.LOG_MESSAGE_CONTENT", "false");
    properties.setProperty("gov.nist.javax.sip.TRACE_LEVEL", "0");
    properties.setProperty("gov.nist.javax.sip.THREAD_POOL_SIZE", "8");
    properties.setProperty("gov.nist.javax.sip.REENTRANT_LISTENER", "true");
    properties.setProperty("javax.sip.AUTOMATIC_DIALOG_SUPPORT", "OFF");
    return properties;
  }

  public void start() throws IOException {
    server.start();
    System.out.println("Server started, listening on " + 50072);
    Runtime.getRuntime().addShutdownHook(new Thread(() -> {
      // Use stderr here since the logger may have been reset by its JVM shutdown
      // hook.
      System.err.println("*** shutting down gRPC server since JVM is shutting down");
      try {
        Requester.this.stop();
      } catch (InterruptedException e) {
        e.printStackTrace(System.err);
      }
      System.err.println("*** server shut down");
    }));
  }

  public void stop() throws InterruptedException {
    if (server != null) {
      server.shutdown().awaitTermination(30, TimeUnit.SECONDS);
    }
  }

  public void sendRequest(final SendMessageRequest request)
    throws InvalidArgumentException, ParseException, SipException {

    List<Header> headers = MessageConverter.createHeadersFromMessage(request.getMessage());

    LOG.debug("Header list size: {}", headers.size());

    // TODO: Allow sending more than just REGISTER requests
    var req = this.messageFactory.createRequest(
      String.format("%s sip:%s;transport=%s SIP/2.0\r\n\r\n",
        request.getMethod(),
        request.getTarget(),
        request.getTransport()));

    headers.forEach(req::addHeader);

    LOG.debug("Sending request: {}", req.toString());

    try {
      var clientTransaction = this.sipProvider.getNewClientTransaction(req);
      clientTransaction.sendRequest();
    } catch (SipException e) {
      LOG.warn(e.getMessage());
    }
  }

  private SipProvider createSipProvider(final String bindAddr, final String proxyAddr)
    throws PeerUnavailableException, TransportNotSupportedException, InvalidArgumentException,
    ObjectInUseException, TransportAlreadySupportedException {

    int port = 7070;

    if (bindAddr.split(":").length == 2) {
      port = Integer.parseInt(bindAddr.split(":")[1]);
    }

    LOG.debug("Binding Requester to " + bindAddr + ":" + port);

    var sipFactory = SipFactory.getInstance();
    sipFactory.setPathName("gov.nist");

    var sipStack = sipFactory.createSipStack(createProperties(proxyAddr));
    var lpTCP = ((sipStack).createListeningPoint(bindAddr, port, "tcp"));
    var lpUDP = (sipStack).createListeningPoint(bindAddr, port, "udp");
    var sipProvider = (sipStack).createSipProvider(lpTCP);
    sipProvider.addListeningPoint(lpUDP);

    try {
      sipProvider.addSipListener(this.requesterService);
    } catch (TooManyListenersException e) {
      LOG.warn(e.getMessage());
    }

    return sipProvider;
  }

}

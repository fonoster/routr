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
import io.grpc.stub.StreamObserver;
import io.routr.headers.MessageConverter;
import io.routr.message.SIPMessage;

import java.io.IOException;
import java.text.ParseException;
import java.util.List;
import java.util.Properties;
import java.util.TooManyListenersException;
import java.util.concurrent.TimeUnit;

import javax.sip.DialogTerminatedEvent;
import javax.sip.IOExceptionEvent;
import javax.sip.InvalidArgumentException;
import javax.sip.ObjectInUseException;
import javax.sip.PeerUnavailableException;
import javax.sip.RequestEvent;
import javax.sip.ResponseEvent;
import javax.sip.SipException;
import javax.sip.SipFactory;
import javax.sip.SipProvider;
import javax.sip.SipStack;
import javax.sip.TimeoutEvent;
import javax.sip.TransactionTerminatedEvent;
import javax.sip.TransportAlreadySupportedException;
import javax.sip.TransportNotSupportedException;
import javax.sip.header.Header;
import javax.sip.message.MessageFactory;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public class Requester {

  private final static Logger LOG = LogManager.getLogger(Requester.class);
  private MessageFactory messageFactory;
  private SipProvider sipProvider;
  private final Server server;

  public Requester(final String proxyAddr, final String bindAddr) {
    server = ServerBuilder.forPort(50072).addService(new RequesterService(this)).build();
    try {
      this.messageFactory = SipFactory.getInstance().createMessageFactory();
      this.sipProvider = createSipProvider(bindAddr, proxyAddr);
    } catch (PeerUnavailableException | TransportNotSupportedException | ObjectInUseException
        | TransportAlreadySupportedException | InvalidArgumentException e) {
      // TODO Auto-generated catch block
      e.printStackTrace();
    }
  }

  public void start() throws IOException {
    server.start();
    System.out.println("Server started, listening on " + 50072);
    Runtime.getRuntime().addShutdownHook(new Thread() {
      @Override
      public void run() {
        // Use stderr here since the logger may have been reset by its JVM shutdown
        // hook.
        System.err.println("*** shutting down gRPC server since JVM is shutting down");
        try {
          Requester.this.stop();
        } catch (InterruptedException e) {
          e.printStackTrace(System.err);
        }
        System.err.println("*** server shut down");
      }
    });
  }

  public void stop() throws InterruptedException {
    if (server != null) {
      server.shutdown().awaitTermination(30, TimeUnit.SECONDS);
    }
  }

  private void blockUntilShutdown() throws InterruptedException {
    if (server != null) {
      server.awaitTermination();
    }
  }

  public void sendRequest(final String target, final SIPMessage request)
      throws InvalidArgumentException, ParseException, SipException {
    List<Header> headers = MessageConverter.createHeadersFromMessage(request);
    // TODO: Allow sending more than just REGISTER requests
    var req = this.messageFactory.createRequest(
        String.format("REGISTER sip:%s;transport=%s SIP/2.0\r\n\r\n", 
          target, request.getRequestUri().getTransportParam()));

    headers.forEach(req::addHeader);

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

    String portStr = bindAddr.split(":")[1];
    int port = 7070;

    if (portStr != null && !portStr.isEmpty()) {
      port = Integer.parseInt(portStr);
    } 

    LOG.debug("Binding Requester to: " + bindAddr + ":" + port);

    var sipFactory = SipFactory.getInstance();
    sipFactory.setPathName("gov.nist");

    var sipStack = sipFactory.createSipStack(createProperties(proxyAddr));
    var lpTCP = ((SipStack) sipStack).createListeningPoint(bindAddr, port, "tcp");
    var lpUDP = ((SipStack) sipStack).createListeningPoint(bindAddr, port, "udp");
    var sipProvider = ((SipStack) sipStack).createSipProvider(lpTCP);
    sipProvider.addListeningPoint(lpUDP);

    try {
      sipProvider.addSipListener(new RequesterSipListener());
    } catch (TooManyListenersException e) {
      LOG.warn(e.getMessage());
    }

    return sipProvider;
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

  private static class RequesterService extends RequesterGrpc.RequesterImplBase {
    private final Requester requester;

    private RequesterService(final Requester requester) {
      this.requester = requester;
    }

    /*@Override
    public void sendMessage(SIPMessage message, StreamObserver<SendMessageResponse> responseObserver) {
      try {
        // TODO: Update proto to accept target and replace here!!!!
        requester.sendRequest("target", message);
        SendMessageResponse response = SendMessageResponse.newBuilder().build();
        responseObserver.onNext(response);
        responseObserver.onCompleted();
      } catch (InvalidArgumentException | ParseException | SipException e) {
        LOG.warn(e.getMessage());
      }
    }*/
  }

  private class RequesterSipListener implements javax.sip.SipListener {
    @Override
    public void processRequest(RequestEvent event) {
      System.out.println(event.getRequest());
    }

    @Override
    public void processResponse(ResponseEvent event) {
      System.out.println(event);
    }

    @Override
    public void processTimeout(TimeoutEvent event) {
      System.out.println(event);
    }

    @Override
    public void processIOException(IOExceptionEvent event) {
      System.out.println(event);
    }

    @Override
    public void processTransactionTerminated(TransactionTerminatedEvent event) {
      System.out.println(event);
    }

    @Override
    public void processDialogTerminated(DialogTerminatedEvent event) {
      System.out.println(event);
    }
  }
}

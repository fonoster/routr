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
package io.routr;

import gov.nist.javax.sip.RequestEventExt;
import gov.nist.javax.sip.SipStackImpl;
import gov.nist.javax.sip.stack.SIPClientTransaction;
import io.grpc.Status;
import io.routr.headers.MessageConverter;
import io.routr.processor.MessageRequest;
import io.routr.processor.ProcessorGrpc;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.LogEvent;
import org.apache.logging.log4j.core.Logger;
import org.apache.logging.log4j.core.appender.AbstractAppender;
import org.apache.logging.log4j.core.config.Configurator;
import org.apache.logging.log4j.core.config.Property;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.sip.ServerTransaction;
import javax.sip.SipProvider;
import javax.sip.address.Address;
import javax.sip.address.SipURI;
import javax.sip.header.CallIdHeader;
import javax.sip.header.RouteHeader;
import javax.sip.header.ViaHeader;
import javax.sip.message.MessageFactory;
import javax.sip.message.Request;
import javax.sip.message.Response;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

/**
 * A request whose top Via carries the branch of one of this EdgePort's live client
 * transactions is a request it sent, come back to it: it is answered 482 Loop Detected
 * and never reaches the processor.
 */
public class LoopDetectionTest {
  private static final String LIVE_BRANCH = "z9hG4bK-Live1";

  private SipProvider sipProvider;
  private SipStackImpl sipStack;
  private ProcessorGrpc.ProcessorBlockingStub blockingStub;
  private MessageConverter messageConverter;
  private MessageFactory messageFactory;
  private ServerTransaction serverTransaction;
  private Response loopDetected;
  private GRPCSipListener listener;
  private final List<LogEvent> warnings = new CopyOnWriteArrayList<>();
  private AbstractAppender appender;
  private Level previousLevel;

  @BeforeEach
  public void setUp() throws Exception {
    sipProvider = mock(SipProvider.class);
    sipStack = mock(SipStackImpl.class);
    blockingStub = mock(ProcessorGrpc.ProcessorBlockingStub.class);
    messageConverter = mock(MessageConverter.class);
    messageFactory = mock(MessageFactory.class);
    serverTransaction = mock(ServerTransaction.class);
    loopDetected = mock(Response.class);

    when(sipProvider.getSipStack()).thenReturn(sipStack);
    when(sipStack.findTransaction(LIVE_BRANCH.toLowerCase(), false))
        .thenReturn(mock(SIPClientTransaction.class));
    when(messageFactory.createResponse(anyInt(), any(Request.class))).thenReturn(loopDetected);
    when(messageConverter.createMessageRequest(any(), any(), any()))
        .thenReturn(MessageRequest.getDefaultInstance());
    // Stops the request right after the processor call: the tests only ask whether it was made
    when(blockingStub.processMessage(any())).thenThrow(Status.UNAVAILABLE.asRuntimeException());

    // The constructor opens a gRPC channel and reads the network; the fields it sets are injected below
    listener = mock(GRPCSipListener.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
    setField("sipProvider", sipProvider);
    setField("blockingStub", blockingStub);
    setField("messageConverter", messageConverter);
    setField("messageFactory", messageFactory);
    setField("transactionManager", new io.routr.utils.TransactionManager());

    appender = new AbstractAppender("loop-test", null, null, true, Property.EMPTY_ARRAY) {
      @Override
      public void append(LogEvent event) {
        warnings.add(event.toImmutable());
      }
    };
    appender.start();
    var logger = (Logger) LogManager.getLogger(GRPCSipListener.class);
    previousLevel = logger.getLevel();
    logger.addAppender(appender);
    // Without a configuration log4j only passes ERROR. Set after addAppender, which
    // rebuilds the logger's configuration.
    Configurator.setLevel(GRPCSipListener.class.getName(), Level.WARN);
  }

  @AfterEach
  public void tearDown() {
    var logger = (Logger) LogManager.getLogger(GRPCSipListener.class);
    logger.removeAppender(appender);
    Configurator.setLevel(GRPCSipListener.class.getName(), previousLevel);
    appender.stop();
  }

  private void setField(String name, Object value) throws Exception {
    var field = GRPCSipListener.class.getDeclaredField(name);
    field.setAccessible(true);
    field.set(listener, value);
  }

  private Request request(String method, String branch, String routeHost) {
    var req = mock(Request.class);
    var via = mock(ViaHeader.class);
    var callId = mock(CallIdHeader.class);
    when(req.getMethod()).thenReturn(method);
    when(req.getHeader(ViaHeader.NAME)).thenReturn(via);
    when(req.getHeader(CallIdHeader.NAME)).thenReturn(callId);
    when(via.getBranch()).thenReturn(branch);
    when(via.getTransport()).thenReturn("UDP");
    when(callId.getCallId()).thenReturn("call-1");
    if (routeHost != null) {
      var route = mock(RouteHeader.class);
      var address = mock(Address.class);
      var uri = mock(SipURI.class);
      when(req.getHeader(RouteHeader.NAME)).thenReturn(route);
      when(route.getAddress()).thenReturn(address);
      when(address.getURI()).thenReturn(uri);
      when(uri.getHost()).thenReturn(routeHost);
    }
    return req;
  }

  private void receive(Request req, ServerTransaction transaction) {
    var event = mock(RequestEventExt.class);
    when(event.getRequest()).thenReturn(req);
    when(event.getServerTransaction()).thenReturn(transaction);
    when(event.getRemoteIpAddress()).thenReturn("10.0.0.5");
    when(event.getRemotePort()).thenReturn(5060);
    listener.processRequest(event);
  }

  private List<String> loopWarnings() {
    return warnings.stream()
        .filter(e -> e.getLevel() == Level.WARN)
        .map(e -> e.getMessage().getFormattedMessage())
        .filter(m -> m.startsWith("loop detected"))
        .toList();
  }

  @Test
  public void aRequestCarryingALiveClientBranchIsAnswered482WithoutTheProcessor()
      throws Exception {
    for (var method : List.of(Request.INVITE, Request.BYE, Request.MESSAGE, Request.OPTIONS)) {
      warnings.clear();
      var req = request(method, LIVE_BRANCH, "routr");

      receive(req, serverTransaction);

      verify(messageFactory).createResponse(Response.LOOP_DETECTED, req);
      assertEquals(List.of("loop detected callId=call-1 route=routr; answered 482"),
          loopWarnings(), method);
    }
    verify(serverTransaction, times(4)).sendResponse(loopDetected);
    verifyNoInteractions(blockingStub);
  }

  @Test
  public void theWarningSaysNoneWhenTheLoopedRequestHasNoRoute() {
    receive(request(Request.INVITE, LIVE_BRANCH, null), serverTransaction);

    assertEquals(List.of("loop detected callId=call-1 route=none; answered 482"),
        loopWarnings());
  }

  @Test
  public void aBranchWithNoLiveClientTransactionIsProcessedAsBefore() throws Exception {
    receive(request(Request.INVITE, "z9hG4bK-other", "routr"), serverTransaction);

    verify(blockingStub).processMessage(any());
    verify(messageFactory, never()).createResponse(anyInt(), any(Request.class));
    assertTrue(loopWarnings().isEmpty());
  }

  @Test
  public void anAckOrCancelCarryingALiveClientBranchIsNeverAnswered482() throws Exception {
    // An ACK has no server transaction; a CANCEL carries its INVITE's branch by design
    receive(request(Request.ACK, LIVE_BRANCH, null), null);
    receive(request(Request.CANCEL, LIVE_BRANCH, null), serverTransaction);

    verify(blockingStub, times(2)).processMessage(any());
    verify(messageFactory, never()).createResponse(anyInt(), any(Request.class));
    verify(serverTransaction, never()).sendResponse(any());
    assertTrue(loopWarnings().isEmpty());
  }
}

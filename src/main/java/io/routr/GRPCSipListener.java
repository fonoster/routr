/*
 * Copyright (C) 2021 by Fonoster Inc (https://fonoster.com)
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
package io.routr;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.StatusRuntimeException;
import javax.sip.SipListener;
import javax.sip.DialogTerminatedEvent;
import javax.sip.IOExceptionEvent;
import javax.sip.RequestEvent;
import javax.sip.ResponseEvent;
import javax.sip.TimeoutEvent;
import javax.sip.TransactionTerminatedEvent;
import javax.sip.header.CallIdHeader;

public class GRPCSipListener implements SipListener {
  private final ProcessorGrpc.ProcessorBlockingStub blockingStub;

  public GRPCSipListener(final String addr) {
    ManagedChannel channel = ManagedChannelBuilder.forTarget(addr)
      .usePlaintext()
      .build();
    blockingStub = ProcessorGrpc.newBlockingStub(channel);
  }

  public void processDialogTerminated(final DialogTerminatedEvent dialogTerminatedEvent) {
  }

  public void processIOException(final IOExceptionEvent exceptionEvent) {
  }

  static MessageRequest createMessageRequest(final RequestEvent requestEvent) {
    String callId = requestEvent.getRequest().getHeader(CallIdHeader.NAME).toString().trim();
    Method method = Method.valueOf(requestEvent.getRequest().getMethod().toUpperCase());
    MessageRequest request = MessageRequest
      .newBuilder()
        .setRef(callId)
        .setDirection(Direction.IN)
        .setMethod(method)
        .build();

    return request;
  }

  public void processRequest(final RequestEvent requestEvent) {
    // - Build message request from request Event
    // - Store the original request in memory until Dialog is complete or 
    //    received a timeout
    // - Send message for processing [x]
    // - Check for errors [x]
    // - Get original request
    // - Merge result into original request
    // - Send forward

    MessageRequest request = GRPCSipListener.createMessageRequest(requestEvent);
    MessageRequest response;

    try {
      response = blockingStub.processMessage(request);
    } catch (StatusRuntimeException e) {
      System.out.println(e.getStatus());
      return;
    }
    System.out.println("Ref: " + response.getRef());
    System.out.println("Direction: " + response.getDirection());
    System.out.println("Method: " + response.getMethod());
  }

  public void processResponse(final ResponseEvent responseEvent) {
    System.out.println(responseEvent);
  }

  public void processTimeout(final TimeoutEvent timeoutEvent) {
  }

  public void processTransactionTerminated(final TransactionTerminatedEvent transactionTerminatedEvent) {
  }
}

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

import io.grpc.stub.StreamObserver;
import io.routr.headers.MessageConverter;
import io.routr.message.SIPMessage;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import javax.sip.*;
import javax.sip.header.CallIdHeader;
import javax.sip.message.Response;
import java.text.ParseException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.FutureTask;
import java.util.concurrent.ThreadPoolExecutor;

public class RequesterService extends RequesterGrpc.RequesterImplBase implements javax.sip.SipListener {
  private final static Logger LOG = LogManager.getLogger(RequesterService.class);
  private final Requester requester;
  private final ThreadPoolExecutor executor = (ThreadPoolExecutor) Executors.newFixedThreadPool(2);
  private final Map<String, ResponseCallable> responseMap;

  public RequesterService(final Requester requester) {
    this.requester = requester;
    this.responseMap = new HashMap<>();
  }

  @Override
  public void sendMessage(SendMessageRequest request, StreamObserver<SendMessageResponse> responseObserver) {
    try {
      requester.sendRequest(request);

      var responseCallable = new ResponseCallable();
      FutureTask<SIPMessage> futureResponse = new FutureTask<>(responseCallable);
      executor.execute(futureResponse);

      this.responseMap.put(request.getMessage().getCallId().getCallId(), responseCallable);

      while (true) {
        if (futureResponse.isDone()) {
          break;
        }
      }

      SendMessageResponse response = SendMessageResponse.newBuilder().setMessage(futureResponse.get()).build();
      responseObserver.onNext(response);
      responseObserver.onCompleted();
    } catch (ExecutionException | InterruptedException | InvalidArgumentException | ParseException | SipException e) {
      LOG.warn(e.getMessage());
    }
  }

  @Override
  public void processRequest(RequestEvent event) {
    // Noop
  }

  @Override
  public void processResponse(ResponseEvent event) {
    var callId = (CallIdHeader) event.getClientTransaction().getRequest().getHeader(CallIdHeader.NAME);
    var callableResponse = this.responseMap.get(callId.getCallId());
    if (callableResponse != null) {
      callableResponse.setValue(MessageConverter.convertToMessageDTO(event.getResponse()));
    }
    this.responseMap.remove(callId.getCallId());
  }

  @Override
  public void processTimeout(TimeoutEvent event) {
    var transaction = event.isServerTransaction()
      ? event.getServerTransaction()
      : event.getClientTransaction();
    var callId = (CallIdHeader) transaction.getRequest().getHeader(CallIdHeader.NAME);
    var callableResponse = this.responseMap.get(callId.getCallId());
    if (callableResponse != null) {
      try {
        var messageFactory = SipFactory.getInstance().createMessageFactory();
        var response = messageFactory.createResponse(Response.REQUEST_TIMEOUT, transaction.getRequest());
        callableResponse.setValue(MessageConverter.convertToMessageDTO(response));
      } catch (ParseException | PeerUnavailableException e) {
        LOG.warn(e.getMessage());
      }
    }
    this.responseMap.remove(callId.getCallId());
  }

  @Override
  public void processIOException(IOExceptionEvent event) {
    LOG.warn(event);
  }

  @Override
  public void processTransactionTerminated(TransactionTerminatedEvent event) {
    // Noop
  }

  @Override
  public void processDialogTerminated(DialogTerminatedEvent event) {
    // Noop
  }
}
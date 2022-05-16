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
package io.routr;

import java.util.*;
import javax.sip.*;
import javax.sip.address.AddressFactory;
import javax.sip.message.*;

import gov.nist.javax.sip.header.ContentLength;
import gov.nist.javax.sip.header.Via;
import javax.sip.header.*;
import java.text.ParseException;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.StatusRuntimeException;
import io.routr.common.Transport;
import io.routr.headers.MessageConverter;
import io.routr.headers.ResponseCode;
import io.routr.message.ResponseType;
import io.routr.processor.*;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public class GRPCSipListener implements SipListener {
  private final ProcessorGrpc.ProcessorBlockingStub blockingStub;
  private final MessageConverter messageConverter;
  private final SipProvider sipProvider;
  private final static Logger LOG = LogManager.getLogger(GRPCSipListener.class);

  public GRPCSipListener(final SipProvider sipProvider, final Map config,
      final List<String> externalIps, final List<String> localnets) {
    MapProxyObject values = new MapProxyObject(config);
    MapProxyObject metadata = (MapProxyObject) values.getMember("metadata");
    MapProxyObject spec = (MapProxyObject) values.getMember("spec");
    MapProxyObject processor = (MapProxyObject) spec.getMember("processor");
    String addr = (String) processor.getMember("addr");
    String bindAddr = (String) spec.getMember("bindAddr");
    String edgePortRef = (String) metadata.getMember("ref");

    if (System.getenv("EDGEPORT_REF") != null) {
      edgePortRef = System.getenv("EDGEPORT_REF");
    }

    LOG.info("starting edgeport (ref = " + edgePortRef + ") service at " + bindAddr);
    LOG.info("localnets list [" + String.join(",", localnets) + "]");
    LOG.info("external ips list [" + String.join(",", externalIps) + "]");

    ManagedChannel channel = ManagedChannelBuilder.forTarget(addr)
        .usePlaintext()
        .build();

    blockingStub = ProcessorGrpc.newBlockingStub(channel);
    this.sipProvider = sipProvider;

    Map<String, NetInterface> listeningPoints = new HashMap<String, NetInterface>();
    Iterator<ListeningPoint> lps = Arrays.stream(sipProvider.getListeningPoints()).iterator();

    while (lps.hasNext()) {
      var currentLp = lps.next();
      var ni = NetInterface.newBuilder()
          .setPort(currentLp.getPort())
          .setHost(currentLp.getIPAddress())
          .setTransport(Transport.valueOf(currentLp.getTransport().toUpperCase()))
          .build();
      listeningPoints.put(currentLp.getTransport().toUpperCase(), ni);
    }

    messageConverter = new MessageConverter(edgePortRef);
    messageConverter.setExternalIps(externalIps);
    messageConverter.setLocalnets(localnets);
    messageConverter.setListeningPoints(listeningPoints);
  }

  public void processRequest(final RequestEvent requestEvent) {
    Request req = requestEvent.getRequest();
    ServerTransaction serverTransaction = requestEvent.getServerTransaction();

    if (serverTransaction == null && req.getMethod().equals(Request.ACK) == false) {
      try {
        serverTransaction = this.sipProvider.getNewServerTransaction(req);
      } catch (TransactionAlreadyExistsException | TransactionUnavailableException e) {
        e.printStackTrace();
        LOG.warn(e.getMessage());
      }
    }

    try {
      MessageRequest request = this.messageConverter.createMessageRequest(requestEvent.getRequest());
      MessageResponse response = blockingStub.processMessage(request);

      List<Header> headers = MessageConverter.createHeadersFromMessage(response.getMessage());

      if (!response.getMessage().hasRequestUri()) {
        sendResponse(serverTransaction, response.getMessage().getResponseType(), headers);
        return;
      }

      AddressFactory addressFactory = SipFactory.getInstance().createAddressFactory();

      var requestUriDTO = response.getMessage().getRequestUri();
      var sipURI = addressFactory.createSipURI(requestUriDTO.getUser(), requestUriDTO.getHost());
      sipURI.setPort(requestUriDTO.getPort());

      req.setRequestURI(sipURI);

      this.sendRequest(serverTransaction, req, headers);
    } catch (StatusRuntimeException | SipException | ParseException | InvalidArgumentException e) {
      e.printStackTrace();
      if (e instanceof StatusRuntimeException) {
        LOG.warn(((StatusRuntimeException) e).getStatus().getDescription());
      } else {
        LOG.warn(e.getMessage());
      }
    }
  }

  public void processResponse(final ResponseEvent responseEvent) {
    try {
      Response res = responseEvent.getResponse();

      if (isStackJob(res)) {
        return;
      }

      MessageRequest request = this.messageConverter.createMessageRequest(res);
      MessageResponse response = blockingStub.processMessage(request);
      List<Header> headers = MessageConverter.createHeadersFromMessage(response.getMessage());

      // Removing all the headers of type Via to avoid duplicates
      res.removeHeader(Via.NAME);

      Iterator<Header> h = headers.iterator();
      while (h.hasNext()) {
        Header header = h.next();
        res.addHeader(header);
      }

      if (isTransactional(responseEvent)) {
        var serverTransaction = responseEvent.getClientTransaction().getApplicationData();
        if (serverTransaction != null) {
          ((ServerTransaction) serverTransaction).sendResponse(res);
        } else if (res.getHeader(ViaHeader.NAME) != null) {
          this.sipProvider.sendResponse(res);
        }
      } else if (res.getHeader(ViaHeader.NAME) != null) {
        this.sipProvider.sendResponse(res);
      }
    } catch (SipException | InvalidArgumentException | ParseException e) {
      LOG.error(e.getMessage());
    }
  }

  public void processTimeout(final TimeoutEvent timeoutEvent) {
    // TODO: Remove timeout transactions
  }

  public void processTransactionTerminated(final TransactionTerminatedEvent transactionTerminatedEvent) {
    // TODO: Remove terminated transactions
  }

  public void processDialogTerminated(final DialogTerminatedEvent dialogTerminatedEvent) {
  }

  public void processIOException(final IOExceptionEvent exceptionEvent) {
    // TODO: Remove failed transactions
  }

  private void sendRequest(final ServerTransaction serverTransaction, final Request request,
      final List<Header> headers) {
    try {
      Request requestOut = updateRequest(request, headers);
      // Does not need a transaction
      if (requestOut.getMethod().equals(Request.ACK)) {
        this.sipProvider.sendRequest(requestOut);
        return;
      }

      var clientTransaction = this.sipProvider.getNewClientTransaction(requestOut);
      clientTransaction.setApplicationData(serverTransaction);
      clientTransaction.sendRequest();
    } catch (SipException e) {
      e.printStackTrace();
      LOG.warn(e.getMessage());
    }
  }

  private static void sendResponse(final ServerTransaction transaction, final ResponseType type,
      final List<Header> headers)
      throws ParseException, InvalidArgumentException, SipException {
    Request request = transaction.getRequest();
    MessageFactory messageFactory = SipFactory.getInstance().createMessageFactory();
    Response response = messageFactory.createResponse(ResponseCode.valueOf(type.toString()).getCode(), request);
    Iterator<Header> h = headers.iterator();
    while (h.hasNext())
      response.addHeader(h.next());
    transaction.sendResponse(response);
  }

  public static Request updateRequest(final Request request, final List<Header> headers) {
    Request requestOut = (Request) request.clone();

    Iterator names = requestOut.getHeaderNames();
    while (names.hasNext()) {
      String n = (String) names.next();
      // WARN: Perhaps we should compute this value
      if (!n.equals(ContentLength.NAME)) {
        requestOut.removeHeader(n);
      }
    }

    var headersIterator = headers.iterator();

    while (headersIterator.hasNext()) {
      Header header = headersIterator.next();
      String s = header.getName();
      if (s.equals("From") || s.equals("To") && s.equals("Call-ID")
          && s.equals("CSeq")) {
        requestOut.setHeader(header);
      } else {
        requestOut.addHeader(header);
      }
    }

    return requestOut;
  }

  public static boolean isTransactional(final ResponseEvent event) {
    return (event.getClientTransaction() != null &&
        hasMethod(event.getResponse(), new String[] { Request.INVITE, Request.MESSAGE }));
  }

  public static boolean isStackJob(final Response response) {
    return hasCodes(response, new int[] { Response.TRYING, Response.REQUEST_TERMINATED })
        || hasMethod(response, new String[] { Request.CANCEL });
  }

  public static boolean hasMethod(final Response response, final String... methods) {
    // Get method from cseq header
    CSeqHeader cseqHeader = (CSeqHeader) response.getHeader(CSeqHeader.NAME);
    var method = cseqHeader.getMethod();
    return Arrays.stream(methods).filter(m -> m == method).toArray().length > 0;
  }

  public static boolean hasCodes(final Response response, final int... codes) {
    return Arrays.stream(codes).filter(c -> c == response.getStatusCode()).toArray().length > 0;
  }
}

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

import java.text.ParseException;
import java.util.*;

import javax.sip.address.SipURI;
import javax.sip.ClientTransaction;
import javax.sip.DialogTerminatedEvent;
import javax.sip.IOExceptionEvent;
import javax.sip.InvalidArgumentException;
import javax.sip.ListeningPoint;
import javax.sip.PeerUnavailableException;
import javax.sip.RequestEvent;
import javax.sip.ResponseEvent;
import javax.sip.ServerTransaction;
import javax.sip.SipException;
import javax.sip.SipFactory;
import javax.sip.SipListener;
import javax.sip.SipProvider;
import javax.sip.TimeoutEvent;
import javax.sip.Transaction;
import javax.sip.TransactionAlreadyExistsException;
import javax.sip.TransactionTerminatedEvent;
import javax.sip.TransactionUnavailableException;
import javax.sip.address.AddressFactory;
import javax.sip.header.*;
import javax.sip.message.MessageFactory;
import javax.sip.message.Request;
import javax.sip.message.Response;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import gov.nist.javax.sip.SipStackExt;
import gov.nist.javax.sip.clientauthutils.AccountManager;
import gov.nist.javax.sip.header.ContentLength;
import gov.nist.javax.sip.header.Via;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.StatusRuntimeException;
import io.routr.common.Transport;
import io.routr.headers.MessageConverter;
import io.routr.headers.ResponseCode;
import io.routr.message.ResponseType;
import io.routr.processor.MessageRequest;
import io.routr.processor.MessageResponse;
import io.routr.processor.NetInterface;
import io.routr.processor.ProcessorGrpc;
import io.routr.utils.AccountManagerImpl;

public class GRPCSipListener implements SipListener {
  private final ProcessorGrpc.ProcessorBlockingStub blockingStub;
  private final MessageConverter messageConverter;
  private final SipProvider sipProvider;
  private final MessageFactory messageFactory;
  private final AddressFactory addressFactory;
  private final HeaderFactory headerFactory;
  private final static Logger LOG = LogManager.getLogger(GRPCSipListener.class);
  private final Map<String, Transaction> activeTransactions = new HashMap<>();

  public GRPCSipListener(final SipProvider sipProvider, final Map<String, Object> config,
      final List<String> externalIps, final List<String> localnets) throws PeerUnavailableException {
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

    Map<String, NetInterface> listeningPoints = new HashMap<>();
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

    this.messageFactory = SipFactory.getInstance().createMessageFactory();
    this.addressFactory = SipFactory.getInstance().createAddressFactory();
    this.headerFactory = SipFactory.getInstance().createHeaderFactory();
  }

  public void processRequest(final RequestEvent event) {
    Request req = event.getRequest();
    ServerTransaction serverTransaction = event.getServerTransaction();

    if (serverTransaction == null && !req.getMethod().equals(Request.ACK)) {
      try {
        serverTransaction = this.sipProvider.getNewServerTransaction(req);
      } catch (TransactionAlreadyExistsException | TransactionUnavailableException e) {
        LOG.warn(e.getMessage());
      }
    }

    try {
      MessageRequest request = this.messageConverter.createMessageRequest(req);
      MessageResponse response = blockingStub.processMessage(request);

      List<Header> headers = MessageConverter.createHeadersFromMessage(response.getMessage());

      if (!response.getMessage().hasRequestUri()) {
        assert serverTransaction != null;
        this.sendResponse(serverTransaction, response.getMessage().getResponseType(), headers);
        return;
      }

      var requestUriDTO = response.getMessage().getRequestUri();
      var sipURI = this.addressFactory.createSipURI(requestUriDTO.getUser(), requestUriDTO.getHost());
      sipURI.setPort(requestUriDTO.getPort());

      req.setRequestURI(sipURI);

      this.sendRequest(serverTransaction, req, headers);
    } catch (StatusRuntimeException | SipException | ParseException | InvalidArgumentException e) {
      if (e instanceof StatusRuntimeException) {
        LOG.warn(((StatusRuntimeException) e).getStatus().getDescription());
      } else {
        LOG.warn(e.getMessage());
      }
    }
  }

  public void processResponse(final ResponseEvent event) {
    try {
      Response res = event.getResponse();

      if (isStackJob(res)) {
        return;
      }

      var isTransactional = isTransactional(event);

      if (isTransactional && authenticationRequired(res)) {
        // Q. What if it has no application data?
        var accountManager = (AccountManager) event.getClientTransaction().getApplicationData();

        if (accountManager == null) {
          // TODO: Should provide additional information about the request
          LOG.warn("no account manager found for transaction");
          return;
        }

        var sipStack = (SipStackExt) this.sipProvider.getSipStack();
        handleAuthChallenge(sipStack, event, accountManager);
        return;
      }

      MessageRequest request = this.messageConverter.createMessageRequest(res);
      MessageResponse response = blockingStub.processMessage(request);
      List<Header> headers = MessageConverter.createHeadersFromMessage(response.getMessage());

      // Removing all the headers of type Via to avoid duplicates
      res.removeHeader(Via.NAME);

      for (Header header : headers) {
        res.addHeader(header);
      }

      if (isTransactional) {
        var req = event.getClientTransaction().getRequest();
        var callId = (CallIdHeader) req.getHeader(CallIdHeader.NAME);
        var originalServerTransaction = (ServerTransaction) this.activeTransactions.get(callId.getCallId() + "_server");
        if (originalServerTransaction != null) {
          originalServerTransaction.sendResponse(res);
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

  public void processTimeout(final TimeoutEvent event) {
    var transaction = event.getClientTransaction() != null
        ? (Transaction) event.getClientTransaction()
        : (Transaction) event.getServerTransaction();
    if (transaction != null) {
      var request = transaction.getRequest();
      var callId = (CallIdHeader) request.getHeader(CallIdHeader.NAME);
      activeTransactions.remove(callId.getCallId() + "_client");
      activeTransactions.remove(callId.getCallId() + "_server");
    }
  }

  public void processTransactionTerminated(final TransactionTerminatedEvent event) {
    var transaction = event.getClientTransaction() != null
        ? (Transaction) event.getClientTransaction()
        : (Transaction) event.getServerTransaction();
    if (transaction != null) {
      var request = transaction.getRequest();
      var callId = (CallIdHeader) request.getHeader(CallIdHeader.NAME);
      activeTransactions.remove(callId.getCallId() + "_client");
      activeTransactions.remove(callId.getCallId() + "_server");
    }
  }

  public void processDialogTerminated(final DialogTerminatedEvent event) {
    // TODO: Remove terminated dialogs
  }

  public void processIOException(final IOExceptionEvent event) {
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

      // Setting authentication artifact
      var host = ((SipURI) requestOut.getRequestURI()).getHost();
      clientTransaction.setApplicationData(createAccountManager(headers, host));
      clientTransaction.sendRequest();

      var callId = (CallIdHeader) requestOut.getHeader(CallIdHeader.NAME);
      this.activeTransactions.put(callId.getCallId() + "_client", clientTransaction);
      this.activeTransactions.put(callId.getCallId() + "_server", serverTransaction);
    } catch (SipException e) {
      LOG.warn(e.getMessage());
    }
  }

  private void sendResponse(final ServerTransaction transaction, final ResponseType type,
      final List<Header> headers) throws ParseException, InvalidArgumentException, SipException {
    Request request = transaction.getRequest();
    Response response = this.messageFactory.createResponse(ResponseCode.valueOf(type.toString()).getCode(), request);
    for (Header header : headers) response.addHeader(header);
    transaction.sendResponse(response);

    var callId = (CallIdHeader) request.getHeader(CallIdHeader.NAME);
    var originalClientTransaction = (ClientTransaction) this.activeTransactions.get(callId.getCallId() + "_client");
    var originalServerTransaction = (ServerTransaction) this.activeTransactions.get(callId.getCallId() + "_server");

    if (request.getMethod().equals(Request.CANCEL) && originalClientTransaction != null) {
      var re = ((ExtensionHeader) response.getHeader("x-request-uri")).getValue();
      var sipURI = this.addressFactory.createSipURI(re.split(",")[0], re.split(",")[1]);
      sipURI.setPort(Integer.parseInt(re.split(",")[2]));

      // Sending Cancel to destination
      var cancelRequest = originalClientTransaction.createCancel();
      cancelRequest.setRequestURI(sipURI);
      this.sipProvider.getNewClientTransaction(cancelRequest).sendRequest();

      // Sends 487 (Request terminated) back to client
      var requestIn = originalServerTransaction.getRequest();
      var terminatedResponse = messageFactory
          .createResponse(Response.REQUEST_TERMINATED, requestIn);
      originalServerTransaction.sendResponse(terminatedResponse);
    }
  }

  private void handleAuthChallenge(final SipStackExt sipStack, final ResponseEvent event,
      final AccountManager accountManager) {
    var authHelper = sipStack.getAuthenticationHelper(accountManager, this.headerFactory);
    // Setting looseRouting to false will cause
    // https://github.com/fonoster/routr/issues/18
    try {
      authHelper.handleChallenge(event.getResponse(), event.getClientTransaction(),
          (SipProvider) event.getSource(), 5, true).sendRequest();
    } catch (NullPointerException | SipException e) {
      LOG.warn(e.getMessage());
    }
  }

  static Request updateRequest(final Request request, final List<Header> headers) {
    Request requestOut = (Request) request.clone();

    Iterator<String> names = requestOut.getHeaderNames();
    while (names.hasNext()) {
      String n = names.next();
      // WARN: Perhaps we should compute this value
      if (!n.equals(ContentLength.NAME)) {
        requestOut.removeHeader(n);
      }
    }

    for (Header header : headers) {
      // Ignore special header
      if (header.getName().equalsIgnoreCase("x-gateway-auth")) {
        continue;
      }

      String s = header.getName();
      if (s.equals(FromHeader.NAME) || s.equals(ToHeader.NAME) && s.equals(CallIdHeader.NAME)
              && s.equals(CSeqHeader.NAME)) {
        requestOut.setHeader(header);
      } else {
        requestOut.addHeader(header);
      }
    }

    return requestOut;
  }

  private static boolean isTransactional(final ResponseEvent event) {
    return (event.getClientTransaction() != null &&
        hasMethod(event.getResponse(), Request.INVITE, Request.MESSAGE));
  }

  private static boolean isStackJob(final Response response) {
    return hasCodes(response, Response.TRYING, Response.REQUEST_TERMINATED)
        || hasMethod(response, Request.CANCEL);
  }

  private static boolean authenticationRequired(final Response response) {
    return hasCodes(response, Response.PROXY_AUTHENTICATION_REQUIRED, Response.UNAUTHORIZED);
  }

  private static boolean hasMethod(final Response response, final String... methods) {
    // Get method from CSeq header
    CSeqHeader cseqHeader = (CSeqHeader) response.getHeader(CSeqHeader.NAME);
    var method = cseqHeader.getMethod();
    return Arrays.stream(methods).filter(m -> Objects.equals(m, method)).toArray().length > 0;
  }

  private static boolean hasCodes(final Response response, final int... codes) {
    return Arrays.stream(codes).filter(c -> c == response.getStatusCode()).toArray().length > 0;
  }

  private static AccountManager createAccountManager(final List<Header> headers, final String host) {
    for (Header header : headers) {
      if (header.getName().equalsIgnoreCase("x-gateway-auth")) {
        var authStr = ((ExtensionHeader) header).getValue();
        var auth = new String(Base64.getDecoder().decode(authStr));

        if (auth.split(":").length != 2) {
          throw new IllegalArgumentException("invalid 'x-gateway-auth' header value; should be base64('username:password')");
        }

        var username = auth.split(":")[0];
        var password = auth.split(":")[1];
        return new AccountManagerImpl(username, password, host);
      }
    }
    return null;
  }
}

/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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

import gov.nist.javax.sip.SipStackExt;
import gov.nist.javax.sip.clientauthutils.AccountManager;
import gov.nist.javax.sip.header.ContentLength;
import gov.nist.javax.sip.header.Via;
import gov.nist.javax.sip.header.Contact;
import gov.nist.javax.sip.header.Route;
import gov.nist.javax.sip.RequestEventExt;
import gov.nist.javax.sip.ResponseEventExt;
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
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import javax.sip.*;
import javax.sip.address.AddressFactory;
import javax.sip.address.SipURI;
import javax.sip.header.*;
import javax.sip.message.MessageFactory;
import javax.sip.message.Request;
import javax.sip.message.Response;
import java.text.ParseException;
import java.util.*;

public class GRPCSipListener implements SipListener {
  private final static Logger LOG = LogManager.getLogger(GRPCSipListener.class);
  private final ProcessorGrpc.ProcessorBlockingStub blockingStub;
  private final MessageConverter messageConverter;
  private final SipProvider sipProvider;
  private final MessageFactory messageFactory;
  private final AddressFactory addressFactory;
  private final HeaderFactory headerFactory;
  private final Map<String, Transaction> activeTransactions = new HashMap<>();

  public GRPCSipListener(final SipProvider sipProvider, final Map<String, Object> config,
      final List<String> externalAddrs, final List<String> localnets) throws PeerUnavailableException {
    System.setProperty("serviceName", "edgeport");
    MapProxyObject values = new MapProxyObject(config);
    // MapProxyObject metadata = (MapProxyObject) values.getMember("metadata");
    MapProxyObject spec = (MapProxyObject) values.getMember("spec");
    MapProxyObject processor = (MapProxyObject) spec.getMember("processor");
    String addr = (String) processor.getMember("addr");
    String bindAddr = (String) spec.getMember("bindAddr");
    String edgePortRef = (String) values.getMember("ref");

    // If running in K8s we set the edgeport ref to the pod name
    if (System.getenv("HOSTNAME") != null) {
      edgePortRef = System.getenv("HOSTNAME");
    }

    if (localnets.isEmpty()) {
      try {
        Enumeration<java.net.NetworkInterface> nets = java.net.NetworkInterface.getNetworkInterfaces();
        for (java.net.NetworkInterface netint : Collections.list(nets)) {
          List<java.net.InterfaceAddress> interfaces = netint.getInterfaceAddresses();
          localnets.add(interfaces.get(0).getAddress().getHostAddress() + "/" + interfaces.get(0).getNetworkPrefixLength());
        }
      } catch (java.net.SocketException e) {
        LOG.error("error getting network interfaces", e);
      }
    }

    LOG.info("starting edgeport ref = {} at {}", edgePortRef, bindAddr);
    LOG.info("localnets list [{}]", String.join(",", localnets));
    LOG.info("external ips list [{}]", String.join(",", externalAddrs));

    ManagedChannel channel = ManagedChannelBuilder.forTarget(addr)
        .usePlaintext()
        .build();

    blockingStub = ProcessorGrpc.newBlockingStub(channel);
    this.sipProvider = sipProvider;

    Iterator<ListeningPoint> lps = Arrays.stream(sipProvider.getListeningPoints()).iterator();
    List<NetInterface> listeningPoints = new ArrayList<>();

    while (lps.hasNext()) {
      var currentLp = lps.next();
      var ni = NetInterface.newBuilder()
          .setPort(currentLp.getPort())
          .setHost(currentLp.getIPAddress())
          .setTransport(Transport.valueOf(currentLp.getTransport().toUpperCase()))
          .build();
      listeningPoints.add(ni);
    }
    messageConverter = new MessageConverter(edgePortRef);
    messageConverter.setExternalAddrs(externalAddrs);
    messageConverter.setLocalnets(localnets);
    messageConverter.setListeningPoints(listeningPoints);

    this.messageFactory = SipFactory.getInstance().createMessageFactory();
    this.addressFactory = SipFactory.getInstance().createAddressFactory();
    this.headerFactory = SipFactory.getInstance().createHeaderFactory();
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
        hasMethod(event.getResponse(), Request.INVITE, Request.MESSAGE, Request.REGISTER));
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
          throw new IllegalArgumentException(
              "invalid 'x-gateway-auth' header value; should be base64('username:password')");
        }

        var username = auth.split(":")[0];
        var password = auth.split(":")[1];
        return new AccountManagerImpl(username, password, host);
      }
    }
    return null;
  }

  public void processRequest(final RequestEvent event) {
    Request req = event.getRequest();
    ServerTransaction serverTransaction = event.getServerTransaction();

    if (serverTransaction == null && !req.getMethod().equals(Request.ACK)) {
      try {
        serverTransaction = this.sipProvider.getNewServerTransaction(req);
      } catch (TransactionAlreadyExistsException | TransactionUnavailableException e) {
        var callId = (CallIdHeader) req.getHeader(CallIdHeader.NAME);
        LOG.error("an exception occurred while processing request with callId: {}", callId, e);
      }
    }

    try {
      MessageRequest request = this.messageConverter.createMessageRequest(req, (RequestEventExt) event, null);
      MessageResponse response = blockingStub.processMessage(request);

      List<Header> headers = MessageConverter.createHeadersFromMessage(response.getMessage());

      // Forwarding SIP response to the client
      if (!response.getMessage().hasRequestUri()) {
        assert serverTransaction != null;
        this.sendResponse(serverTransaction, response.getMessage().getResponseType(), headers, response.getMessage().getReasonPhrase());
        return;
      }

      var requestUriDTO = response.getMessage().getRequestUri();
      var sipURI = this.addressFactory.createSipURI(requestUriDTO.getUser(), requestUriDTO.getHost());
      sipURI.setPort(requestUriDTO.getPort());

      req.setRequestURI(sipURI);

      if (!response.getMessage().getBody().isEmpty()) {
        assert req.getHeader(ContentTypeHeader.NAME) != null;
        req.setContent(response.getMessage().getBody(), (ContentTypeHeader) req.getHeader(ContentTypeHeader.NAME));
      }

      if (req.getMethod().equals(Request.CANCEL)) {
        assert serverTransaction != null;
        this.sendCancel(serverTransaction, req, headers);
        return;
      }
      this.sendRequest(serverTransaction, req, headers);
    } catch (StatusRuntimeException | SipException | ParseException | InvalidArgumentException e) {
      var callId = (CallIdHeader) req.getHeader(CallIdHeader.NAME);

      if (e instanceof StatusRuntimeException) {
        var description = ((StatusRuntimeException) e).getStatus().getDescription();
        LOG.warn("an exception occurred while processing request with callId: {}, status description: {}", callId,
            description, e);
      } else {
        LOG.warn("an exception occurred while processing callId: {}", callId, e);
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
        var accountManager = (AccountManager) event.getClientTransaction().getApplicationData();

        if (accountManager == null) {
          var req = event.getClientTransaction().getRequest();
          var callId = (CallIdHeader) req.getHeader(CallIdHeader.NAME);
          LOG.warn("an exception occurred while processing response with callId: {}", callId);
          return;
        }

        var sipStack = (SipStackExt) this.sipProvider.getSipStack();
        handleAuthChallenge(sipStack, event, accountManager);
        return;
      }

      MessageRequest request = this.messageConverter.createMessageRequest(res, null, 
        (ResponseEventExt) event);
      MessageResponse response = blockingStub.processMessage(request);
      List<Header> headers = MessageConverter.createHeadersFromMessage(response.getMessage());

      // Update reason phrase
      if (response.getMessage().getReasonPhrase() != null) {
        res.setReasonPhrase(response.getMessage().getReasonPhrase());
      }

      if (!response.getMessage().getBody().isEmpty()) {
        assert res.getHeader(ContentTypeHeader.NAME) != null;
        res.setContent(response.getMessage().getBody(), (ContentTypeHeader) res.getHeader(ContentTypeHeader.NAME));
      }

      // Removing all the headers of type Via and Contact to avoid duplicates
      res.removeHeader(Via.NAME);
      res.removeHeader(Contact.NAME);
      res.removeHeader(Route.NAME);

      for (Header header : headers) {
        // WARNING: Using setHeader causes some headers to be overwritten 
        res.addHeader(header);
      }

      if (isTransactional) {
        var req = event.getClientTransaction().getRequest();
        var callId = (CallIdHeader) req.getHeader(CallIdHeader.NAME);
        var originalServerTransaction = (ServerTransaction) this.activeTransactions.get(callId.getCallId() + "_server");
        if (originalServerTransaction != null) {
          // The response CSeq number must be the same as the original request CSeq number
          var originalCSeq = (CSeqHeader) originalServerTransaction.getRequest().getHeader(CSeqHeader.NAME);
          res.setHeader(originalCSeq);
          originalServerTransaction.sendResponse(res);
        } else if (res.getHeader(ViaHeader.NAME) != null) {
          this.sipProvider.sendResponse(res);
        }
      } else if (res.getHeader(ViaHeader.NAME) != null) {
        this.sipProvider.sendResponse(res);
      }
    } catch (SipException | InvalidArgumentException | ParseException e) {
      var req = event.getClientTransaction().getRequest();
      var callId = (CallIdHeader) req.getHeader(CallIdHeader.NAME);
      LOG.warn("an exception occurred while processing response with callId: {}", callId, e);
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
      var callId = (CallIdHeader) requestOut.getHeader(CallIdHeader.NAME);
      // Does not need a transaction
      if (requestOut.getMethod().equals(Request.ACK)) {
        var transaction = this.activeTransactions.get(callId.getCallId() + "_client");
        // If appData is set increase the CSeq for the Ack request
        if (transaction != null && transaction.getApplicationData() != null) {
          var cSeq = (CSeqHeader) requestOut.getHeader(CSeqHeader.NAME);
          try {
            cSeq.setSeqNumber(cSeq.getSeqNumber() + 1);
          } catch (InvalidArgumentException e) {
            LOG.warn("an exception occurred while processing callId: {}", callId, e);
          }
        }
        this.sipProvider.sendRequest(requestOut);
        return;
      }

      var clientTransaction = this.sipProvider.getNewClientTransaction(requestOut);

      // Setting authentication artifact
      var host = ((SipURI) requestOut.getRequestURI()).getHost();
      clientTransaction.setApplicationData(createAccountManager(headers, host));
      clientTransaction.sendRequest();
      this.activeTransactions.put(callId.getCallId() + "_client", clientTransaction);
      this.activeTransactions.put(callId.getCallId() + "_server", serverTransaction);
    } catch (SipException e) {
      var callId = (CallIdHeader) request.getHeader(CallIdHeader.NAME);
      LOG.warn("an exception occurred while sending request with callId: {}", callId, e);
    }
  }

  private void sendCancel(final ServerTransaction serverTransaction, final Request request, 
      final List<Header> headers) {
    try {
      var callId = (CallIdHeader) request.getHeader(CallIdHeader.NAME);
      var originalClientTransaction = (ClientTransaction) this.activeTransactions.get(callId.getCallId() + "_client");
      var originalServerTransaction = (ServerTransaction) this.activeTransactions.get(callId.getCallId() + "_server");      

      // Let client know we are processing the request
      var cancelResponse = this.messageFactory.createResponse(
        Response.OK,
        serverTransaction.getRequest()
      );

      serverTransaction.sendResponse(cancelResponse);

      // Send CANCEL request to destination
      var cseq = ((CSeqHeader) originalServerTransaction.getRequest().getHeader(CSeqHeader.NAME)).getSeqNumber();
      var cseqHeader = this.headerFactory.createCSeqHeader(
        cseq,
        Request.CANCEL
      );

      var cancelRequest = originalClientTransaction.createCancel();
      cancelRequest.setHeader(cseqHeader);
      var clientTransaction = this.sipProvider.getNewClientTransaction(
        cancelRequest
      );

      clientTransaction.sendRequest();

      // Sends 487 (Request terminated) back to client
      var terminatedResponse = this.messageFactory.createResponse(
        Response.REQUEST_TERMINATED,
        originalServerTransaction.getRequest()
      );

      originalServerTransaction.sendResponse(terminatedResponse);
    } catch (SipException | InvalidArgumentException | ParseException e) {
      var callId = (CallIdHeader) request.getHeader(CallIdHeader.NAME);
      LOG.warn("an exception occurred while sending a CANCEL request for callId: {}", callId, e);
    }
  }

  private void sendResponse(final ServerTransaction transaction, final ResponseType type,
      final List<Header> headers, final String reasonPhrase) throws ParseException, InvalidArgumentException, SipException {
    Request request = transaction.getRequest();
    Response response = this.messageFactory.createResponse(ResponseCode.valueOf(type.name()).getCode(), request);
    
    if (reasonPhrase != null) {
      response.setReasonPhrase(reasonPhrase);
    }

    for (Header header : headers)
      response.addHeader(header);
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
      var request = event.getClientTransaction().getRequest();
      var callId = (CallIdHeader) request.getHeader(CallIdHeader.NAME);
      LOG.warn("an exception occurred while handling authentication challenge for callId: {}", callId, e);
    }
  }
}

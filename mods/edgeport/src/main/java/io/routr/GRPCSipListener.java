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

import gov.nist.javax.sip.SipStackExt;
import gov.nist.javax.sip.clientauthutils.AccountManager;
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
import io.routr.utils.*;
import io.routr.events.*;
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
import java.io.IOException;

public class GRPCSipListener implements SipListener {
  private static final Logger LOG = LogManager.getLogger(GRPCSipListener.class);
  private final ProcessorGrpc.ProcessorBlockingStub blockingStub;
  private final MessageConverter messageConverter;
  private final SipProvider sipProvider;
  private final MessageFactory messageFactory;
  private final AddressFactory addressFactory;
  private final HeaderFactory headerFactory;
  private final TransactionManager transactionManager;
  private final EventProcessor eventProcessor;
  private final AuthenticationHandler authenticationHandler;
  private final boolean stripSessionProgressSdp;

  public GRPCSipListener(final SipProvider sipProvider, final Map<String, Object> config,
      final List<String> externalAddrs, final List<String> localnets)
      throws IOException, PeerUnavailableException, InterruptedException {
    System.setProperty("serviceName", "edgeport");
    MapProxyObject values = new MapProxyObject(config);
    MapProxyObject spec = (MapProxyObject) values.getMember("spec");
    MapProxyObject processor = (MapProxyObject) spec.getMember("processor");
    String addr = (String) processor.getMember("addr");
    String bindAddr = (String) spec.getMember("bindAddr");
    String edgePortRef = (String) values.getMember("ref");

    String processorAddrEnv = System.getenv("PROCESSOR_ADDR");
    String ignoreLoopbackEnv = System.getenv("IGNORE_LOOPBACK_FROM_LOCALNETS");
    String hostnameEnv = System.getenv("HOSTNAME");
    String stripSessionProgressSdpEnv = System.getenv("STRIP_SESSION_PROGRESS_SDP");
    this.stripSessionProgressSdp = Boolean.parseBoolean(stripSessionProgressSdpEnv);

    if (processorAddrEnv != null) {
      addr = processorAddrEnv;
    }

    if (hostnameEnv != null) {
      edgePortRef = hostnameEnv;
    }

    if (localnets.isEmpty()) {
      try {
        Enumeration<java.net.NetworkInterface> nets = java.net.NetworkInterface.getNetworkInterfaces();
        for (java.net.NetworkInterface netint : Collections.list(nets)) {
          List<java.net.InterfaceAddress> interfaces = netint.getInterfaceAddresses();
          
          var host = interfaces.get(0).getAddress().getHostAddress();

          if (Boolean.parseBoolean(ignoreLoopbackEnv) && host.startsWith("127.0.0.1")) {
            continue;
          }

          localnets
              .add(interfaces.get(0).getAddress().getHostAddress() + "/" + interfaces.get(0).getNetworkPrefixLength());
        }
      } catch (java.net.SocketException e) {
        LOG.error("error getting network interfaces", e);
      }
    }

    LOG.info("starting edgeport ref = {} at {}", edgePortRef, bindAddr);
    LOG.info("localnets list [{}]", String.join(",", localnets));
    LOG.info("external hosts list [{}]", String.join(",", externalAddrs));

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

    // Initialize extracted components
    this.transactionManager = new TransactionManager();
    List<EventsPublisher> publishers = new ArrayList<>();
    
    String consolePublisherEnabledEnv = System.getenv("CONSOLE_PUBLISHER_ENABLED");
    String natPublisherEnabledEnv = System.getenv("NATS_PUBLISHER_ENABLED");
    String natsPublisherSubjectEnv = System.getenv("NATS_PUBLISHER_SUBJECT");
    String natsPublisherUrlEnv = System.getenv("NATS_PUBLISHER_URL");

    if (Boolean.parseBoolean(consolePublisherEnabledEnv)) {
      publishers.add(new ConsolePublisher());
      LOG.info("console publisher enabled");
    }

    if (Boolean.parseBoolean(natPublisherEnabledEnv)) {
      String subject = natsPublisherSubjectEnv;
      String natsUrl = natsPublisherUrlEnv;
      if (natsUrl == null) {
        natsUrl = "nats://localhost:4222";
      }

      if (subject == null) {
        subject = "routr";
      }

      publishers.add(new NATSPublisher(natsUrl, subject));

      LOG.info("nats publisher enabled with subject {} and url {}", subject, natsUrl);
    }
    
    this.eventProcessor = new EventProcessor(publishers);
    this.authenticationHandler = new AuthenticationHandler(
        (SipStackExt) this.sipProvider.getSipStack(), this.headerFactory);
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

      boolean isRequest = response.getMessage().hasRequestUri();
      var method = event.getRequest().getMethod();

      // WARNING: The Expires always returns zero. Should check if this is a bug
      if (isRequest && method.equals(Request.INVITE)) {
        eventProcessor.processCallStartedEvent(response);
      } else if (isRequest && method.equals(Request.CANCEL)) {
        eventProcessor.processCallEndedEvent(response);
      } else if (!isRequest && method.equals(Request.REGISTER) 
        && response.getMessage().getResponseType().equals(ResponseType.OK)) {

        var expires = req.getHeader(ExpiresHeader.NAME) != null
          ? ((ExpiresHeader)req.getHeader(ExpiresHeader.NAME)).getExpires()
          : 0;

        // WARNING: The Expires from the MessageRequest always returns zero. 
        // Should check if this is a bug.
        eventProcessor.processRegistrationEvent(request, expires);
      }

      // This is needed so that processors can send responses to the client 
      // that include body content.
      if (!isRequest) {
        assert serverTransaction != null;
        String body = response.getMessage().getBody();
        ContentTypeHeader contentTypeHeader = null;
        
        // Try to get ContentTypeHeader from the response headers first
        for (Header header : headers) {
          if (header instanceof ContentTypeHeader) {
            contentTypeHeader = (ContentTypeHeader) header;
            break;
          }
        }
        
        // If not in headers, try to get from original request
        if (contentTypeHeader == null && req.getHeader(ContentTypeHeader.NAME) != null) {
          contentTypeHeader = (ContentTypeHeader) req.getHeader(ContentTypeHeader.NAME);
        }
        
        this.sendResponse(serverTransaction, response.getMessage().getResponseType(), headers,
            response.getMessage().getReasonPhrase(), body, contentTypeHeader);
        return;
      }

      var requestUriDTO = response.getMessage().getRequestUri();
      var userPart = requestUriDTO.getUser().isEmpty() ? null : requestUriDTO.getUser();
      var sipURI = this.addressFactory.createSipURI(userPart, requestUriDTO.getHost());
      sipURI.setPort(requestUriDTO.getPort());

      req.setRequestURI(sipURI);

      if (!response.getMessage().getBody().isEmpty()) {
        assert req.getHeader(ContentTypeHeader.NAME) != null;
        req.setContent(response.getMessage().getBody(), (ContentTypeHeader) req.getHeader(ContentTypeHeader.NAME));
      }

      if (req.getMethod().equals(Request.CANCEL)) {
        assert serverTransaction != null;
        this.sendCancel(serverTransaction, req);
        return;
      }
      this.sendRequest(serverTransaction, req, headers);
    } catch (StatusRuntimeException | SipException | ParseException | InvalidArgumentException e) {
      var callId = (CallIdHeader) req.getHeader(CallIdHeader.NAME);

      if (e instanceof StatusRuntimeException) {
        var description = ((StatusRuntimeException) e).getStatus().getDescription();
        LOG.debug("an exception occurred while processing request with callId: {}, status description: {}", callId,
            description, e);
      } else {
        LOG.debug("an exception occurred while processing callId: {}", callId, e);
      }
    }
  }

  public void processResponse(final ResponseEvent event) {
    try {
      Response res = event.getResponse();

      if (ResponseHelper.isStackJob(res)) {
        return;
      }

      if (stripSessionProgressSdp
          && ResponseHelper.hasCodes(res, Response.SESSION_PROGRESS)) {
        res.removeContent();
        res.removeHeader(ContentTypeHeader.NAME);
      }

      var isTransactional = ResponseHelper.isTransactional(event, res);

      if (isTransactional && AuthenticationHandler.authenticationRequired(res)) {
        var accountManager = (AccountManager) event.getClientTransaction().getApplicationData();

        if (accountManager != null) {
          var req = event.getClientTransaction().getRequest();
          var callId = (CallIdHeader) req.getHeader(CallIdHeader.NAME);

          LOG.debug("authenticating on behalf of callId: {}", callId);

          ClientTransaction newClientTransaction = authenticationHandler.handleAuthChallenge(event, accountManager);
          if (newClientTransaction != null) {
            // Update activeTransactions with the new authenticated transaction
            transactionManager.updateClientTransaction(callId.getCallId(), newClientTransaction);
            // The retry above incremented this dialog's CSeq on this leg alone; every
            // later request forwarded on it must carry the same offset (see sendRequest).
            transactionManager.recordAuthenticated(callId.getCallId());
          }
          return;
        }
      }

      MessageRequest request = this.messageConverter.createMessageRequest(res, null,
          (ResponseEventExt) event);
      MessageResponse response = blockingStub.processMessage(request);
      List<Header> headers = MessageConverter.createHeadersFromMessage(response.getMessage());

      if (ResponseHelper.hasMethod(res, Request.BYE) ||
          (ResponseHelper.hasMethod(res, Request.INVITE) && res.getStatusCode() > 300)) {
        eventProcessor.processCallEndedEvent(response);
      } 

      // Update reason phrase
      if (response.getMessage().getReasonPhrase() != null) {
        res.setReasonPhrase(response.getMessage().getReasonPhrase());
      }

      if (!response.getMessage().getBody().isEmpty()) {
        assert res.getHeader(ContentTypeHeader.NAME) != null;
        res.setContent(response.getMessage().getBody(), (ContentTypeHeader) res.getHeader(ContentTypeHeader.NAME));
      }

      // Removing headers to avoid duplicates
      ResponseHelper.removeHeadersToReplace(res);

      for (Header header : headers) {
        // WARNING: Using setHeader causes some headers to be overwritten
        res.addHeader(header);
      }

      if (isTransactional) {
        var req = event.getClientTransaction().getRequest();
        var callId = (CallIdHeader) req.getHeader(CallIdHeader.NAME);
        var originalServerTransaction = transactionManager.getServerTransaction(callId.getCallId());
        boolean isWebSocket = TransportDetector.isWebSocketTransport(req);
        
        if (originalServerTransaction != null) {
          // The response CSeq number must be the same as the original request CSeq number
          var originalCSeq = (CSeqHeader) originalServerTransaction.getRequest().getHeader(CSeqHeader.NAME);
          res.setHeader(originalCSeq);
          SipMessageSender.sendResponse(originalServerTransaction, res, isWebSocket);
        } else if (res.getHeader(ViaHeader.NAME) != null) {
          // No server transaction left to copy the caller's CSeq from, so fall back
          // to the recorded original the same way the non-transactional branch does.
          restoreCallerCSeq(res);
          SipMessageSender.sendResponse(sipProvider, res, isWebSocket);
        }
      } else if (res.getHeader(ViaHeader.NAME) != null) {
        // BYE lands here (isTransactional covers only INVITE/MESSAGE/REGISTER) and so
        // misses the CSeq restoration above. RFC 3261 §8.2.6.2: echo the caller's CSeq.
        restoreCallerCSeq(res);

        // For non-transactional responses, we need to check the Via header from the response
        // Since we don't have the original request, we'll use a conservative approach
        boolean isWebSocket = false;
        ViaHeader viaHeader = (ViaHeader) res.getHeader(ViaHeader.NAME);
        if (viaHeader != null && viaHeader.getTransport() != null) {
          String transport = viaHeader.getTransport().toLowerCase();
          isWebSocket = "ws".equals(transport) || "wss".equals(transport);
        }
        SipMessageSender.sendResponse(sipProvider, res, isWebSocket);
      }

      releaseDialogIfEnded(res);
    } catch (SipException | InvalidArgumentException | ParseException e) {
      var req = event.getClientTransaction().getRequest();
      var callId = (CallIdHeader) req.getHeader(CallIdHeader.NAME);
      LOG.debug("an exception occurred while processing response with callId: {}", callId, e);
    }
  }

  /**
   * Drops a dialog's CSeq bookkeeping once the dialog is provably over.
   *
   * processDialogTerminated never fires for these dialogs, so depending on it leaks one
   * cseqOffsets entry per proxy-authenticated call for the life of the process. An
   * answered BYE or a failed INVITE both mean nothing further will be forwarded on this
   * call. Runs after the response is sent: restoring its CSeq needs the state released
   * here.
   *
   * @param res The response just relayed toward the caller
   */
  private void releaseDialogIfEnded(final Response res) {
    if (res.getStatusCode() < 200) {
      return;
    }

    var ended = ResponseHelper.hasMethod(res, Request.BYE)
        || (ResponseHelper.hasMethod(res, Request.INVITE) && res.getStatusCode() >= 300);
    var callId = (CallIdHeader) res.getHeader(CallIdHeader.NAME);

    if (ended && callId != null) {
      transactionManager.removeDialog(callId.getCallId());
    }
  }

  public void processTimeout(final TimeoutEvent event) {
    var transaction = event.getClientTransaction() != null
        ? (Transaction) event.getClientTransaction()
        : (Transaction) event.getServerTransaction();
    if (transaction != null) {
      var request = transaction.getRequest();
      var callId = (CallIdHeader) request.getHeader(CallIdHeader.NAME);
      if (callId != null) {
        // Same sibling-in-flight caveat as processTransactionTerminated below.
        transactionManager.removeTransaction(callId.getCallId(), transaction);
      }
    }
  }

  public void processTransactionTerminated(final TransactionTerminatedEvent event) {
    var transaction = event.getClientTransaction() != null
        ? (Transaction) event.getClientTransaction()
        : (Transaction) event.getServerTransaction();
    if (transaction != null) {
      var request = transaction.getRequest();
      var callId = (CallIdHeader) request.getHeader(CallIdHeader.NAME);
      if (callId != null) {
        // Slots are keyed by call ID, which a dialog's INVITE and later BYE share, so
        // release only what this transaction still holds.
        transactionManager.removeTransaction(callId.getCallId(), transaction);
      }
    }
  }

  /**
   * Puts the caller's own CSeq back on a response whose request sendRequest had shifted
   * by the dialog's proxy-auth offset.
   *
   * Looks up the number sendRequest recorded rather than deriving it (by subtracting
   * the offset, or by copying from the server transaction): both alternatives depend
   * on shared state whose lifetime races response handling once the call runs long
   * enough. No-op unless a matching call+method was recorded.
   *
   * @param res The response about to be sent back toward the caller
   */
  private void restoreCallerCSeq(final Response res) {
    var callId = (CallIdHeader) res.getHeader(CallIdHeader.NAME);
    var cSeq = (CSeqHeader) res.getHeader(CSeqHeader.NAME);

    if (callId == null || cSeq == null) {
      return;
    }

    var originalSeqNumber = transactionManager.getOriginalCSeq(callId.getCallId(), cSeq.getMethod());
    if (originalSeqNumber < 0) {
      return;
    }

    try {
      cSeq.setSeqNumber(originalSeqNumber);
    } catch (InvalidArgumentException e) {
      LOG.debug("an exception occurred while restoring the CSeq for callId: {}", callId, e);
    }

    // Final response: nothing else will consume this recording, so drop it now
    // rather than waiting for dialog teardown.
    if (res.getStatusCode() >= 200) {
      transactionManager.removeOriginalCSeq(callId.getCallId(), cSeq.getMethod());
    }
  }

  public void processDialogTerminated(final DialogTerminatedEvent event) {
    // Belt and braces: observed never to fire for proxied dialogs, which is why
    // releaseDialogIfEnded exists. Harmless if a future stack version does fire it.
    var dialog = event.getDialog();
    if (dialog != null && dialog.getCallId() != null) {
      transactionManager.removeDialog(dialog.getCallId().getCallId());
    }
  }

  public void processIOException(final IOExceptionEvent event) {
    String transport = event.getTransport();
    String host = event.getHost();
    int port = event.getPort();
    LOG.warn("transport error on {}:{} via {}; cleaning up related transactions.", host, port, transport);

    // Find and remove all transactions associated with this transport, host, port combo
    List<Transaction> removedTransactions = transactionManager.removeTransactionsByTransport(transport, host, port);

    for (Transaction tx : removedTransactions) {
      LOG.info("removed transaction due to transport error on {}:{} via {}", host, port, transport);
      // Fire call-ended event if possible
      try {
        Request req = tx.getRequest();
        if (req != null) {
          // Create a minimal MessageResponse to pass to processCallEndedEvent
          // Use the callId from the request
          CallIdHeader callIdHeader = (CallIdHeader) req.getHeader(CallIdHeader.NAME);
          if (callIdHeader != null) {
            // Build a dummy MessageResponse with UNKNOWN cause
            io.routr.message.CallID callId = io.routr.message.CallID.newBuilder().setCallId(callIdHeader.getCallId()).build();
            io.routr.message.SIPMessage sipMsg = io.routr.message.SIPMessage.newBuilder().setCallId(callId).build();
            MessageResponse dummyResponse = MessageResponse.newBuilder().setMessage(sipMsg).build();
            eventProcessor.processCallEndedEvent(dummyResponse);
          }
        }
      } catch (Exception e) {
        LOG.warn("failed to fire call-ended event for transaction: {}", e.getMessage());
      }
    }
    if (removedTransactions.isEmpty()) {
      LOG.info("no active transactions matched the transport error on {}:{} via {}", host, port, transport);
    }
  }

  private void sendRequest(final ServerTransaction serverTransaction, final Request request,
      final List<Header> headers) {
    try {
      Request requestOut = RequestUpdater.updateRequest(request, headers);
      var callId = (CallIdHeader) requestOut.getHeader(CallIdHeader.NAME);

      // Check if this is a WebSocket/WSS connection to prevent recursive loop
      boolean isWebSocket = TransportDetector.isWebSocketTransport(requestOut);

      // A proxy-initiated authentication retry on this dialog silently incremented
      // CSeq on the downstream leg alone (see AuthenticationHandler#handleAuthChallenge
      // and TransactionManager#recordAuthenticated); every request forwarded afterward
      // must carry the same offset or the downstream side sees a CSeq it has already
      // processed and rejects it — previously this was applied to the ACK that follows
      // the retried INVITE, but no other in-dialog request (chiefly BYE), which left
      // the call unable to be torn down and billing for time after the caller hung up.
      int cseqOffset = transactionManager.getCseqOffset(callId.getCallId());
      if (cseqOffset > 0) {
        var cSeq = (CSeqHeader) requestOut.getHeader(CSeqHeader.NAME);
        try {
          // Capture the caller's number before shifting it so the response can be
          // restored later regardless of how long the offset/transaction bookkeeping
          // this call also relies on survives (see restoreCallerCSeq).
          transactionManager.recordOriginalCSeq(callId.getCallId(), cSeq.getMethod(), cSeq.getSeqNumber());
          cSeq.setSeqNumber(cSeq.getSeqNumber() + cseqOffset);
        } catch (InvalidArgumentException e) {
          LOG.debug("an exception occurred while applying the CSeq offset for callId: {}", callId, e);
        }
      }

      // Does not need a transaction
      if (requestOut.getMethod().equals(Request.ACK)) {
        SipMessageSender.sendRequest(this.sipProvider, requestOut, isWebSocket);
        return;
      }

      var clientTransaction = this.sipProvider.getNewClientTransaction(requestOut);

      // Setting authentication artifact
      var host = ((SipURI) requestOut.getRequestURI()).getHost();
      clientTransaction.setApplicationData(AuthenticationHandler.createAccountManager(headers, host));
      SipMessageSender.sendRequest(clientTransaction, isWebSocket);
      transactionManager.putTransactions(callId.getCallId(), clientTransaction, serverTransaction);
    } catch (SipException e) {
      var callId = (CallIdHeader) request.getHeader(CallIdHeader.NAME);
      LOG.debug("an exception occurred while sending request with callId: {}", callId, e);
    }
  }

  private void sendCancel(final ServerTransaction serverTransaction, final Request request) {
    try {
      var callId = (CallIdHeader) request.getHeader(CallIdHeader.NAME);
      var originalClientTransaction = transactionManager.getClientTransaction(callId.getCallId());
      var originalServerTransaction = transactionManager.getServerTransaction(callId.getCallId());

      // Check if this is a WebSocket/WSS connection to prevent recursive loop
      boolean isWebSocket = TransportDetector.isWebSocketTransport(request);

      // Let client know we are processing the request
      var cancelResponse = this.messageFactory.createResponse(
          Response.OK,
          serverTransaction.getRequest());

      SipMessageSender.sendResponse(serverTransaction, cancelResponse, isWebSocket);

      // Send CANCEL request to destination
      var cseq = ((CSeqHeader) originalServerTransaction.getRequest().getHeader(CSeqHeader.NAME)).getSeqNumber();
      var cseqHeader = this.headerFactory.createCSeqHeader(
          cseq,
          Request.CANCEL);

      var cancelRequest = originalClientTransaction.createCancel();
      cancelRequest.setHeader(cseqHeader);
      var clientTransaction = this.sipProvider.getNewClientTransaction(
          cancelRequest);

      SipMessageSender.sendRequest(clientTransaction, isWebSocket);

      // Sends 487 (Request terminated) back to client
      var terminatedResponse = this.messageFactory.createResponse(
          Response.REQUEST_TERMINATED,
          originalServerTransaction.getRequest());

      SipMessageSender.sendResponse(originalServerTransaction, terminatedResponse, isWebSocket);
    } catch (SipException | InvalidArgumentException | ParseException e) {
      var callId = (CallIdHeader) request.getHeader(CallIdHeader.NAME);
      LOG.debug("an exception occurred while sending a CANCEL request for callId: {}", callId, e);
    }
  }

  private void sendResponse(final ServerTransaction transaction, final ResponseType type,
      final List<Header> headers, final String reasonPhrase, final String body,
      final ContentTypeHeader contentTypeHeader)
      throws ParseException, InvalidArgumentException, SipException {
    Request request = transaction.getRequest();
    Response response = this.messageFactory.createResponse(ResponseCode.valueOf(type.name()).getCode(), request);

    if (reasonPhrase != null) {
      response.setReasonPhrase(reasonPhrase);
    }

    for (Header header : headers) {
      response.addHeader(header);
    }

    // Set body content if provided
    if (body != null && !body.isEmpty() && contentTypeHeader != null) {
      response.setContent(body, contentTypeHeader);
    }

    // Check if this is a WebSocket/WSS connection to prevent recursive loop
    boolean isWebSocket = TransportDetector.isWebSocketTransport(request);
    var callId = (CallIdHeader) request.getHeader(CallIdHeader.NAME);
    var method = request.getMethod();
    
    if (isWebSocket) {
      LOG.debug("sending response for {} via WebSocket/WSS transport for callId: {}, method: {}", 
          type, callId != null ? callId.getCallId() : "unknown", method);
    }
    
    SipMessageSender.sendResponse(transaction, response, isWebSocket);

    var originalClientTransaction = transactionManager.getClientTransaction(callId.getCallId());
    var originalServerTransaction = transactionManager.getServerTransaction(callId.getCallId());

    if (request.getMethod().equals(Request.CANCEL) && originalClientTransaction != null) {
      var re = ((ExtensionHeader) response.getHeader("x-request-uri")).getValue();
      var sipURI = this.addressFactory.createSipURI(re.split(",")[0], re.split(",")[1]);
      sipURI.setPort(Integer.parseInt(re.split(",")[2]));

      // Sending Cancel to destination
      var cancelRequest = originalClientTransaction.createCancel();
      cancelRequest.setRequestURI(sipURI);
      var cancelClientTransaction = this.sipProvider.getNewClientTransaction(cancelRequest);
      SipMessageSender.sendRequest(cancelClientTransaction, isWebSocket);

      // Sends 487 (Request terminated) back to client
      // Use the same WebSocket detection from the original request
      var requestIn = originalServerTransaction.getRequest();
      var terminatedResponse = messageFactory
          .createResponse(Response.REQUEST_TERMINATED, requestIn);
      SipMessageSender.sendResponse(originalServerTransaction, terminatedResponse, isWebSocket);
    }
  }

}

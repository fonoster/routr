/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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

import javax.sip.*;
import javax.sip.header.*;
import javax.sip.address.AddressFactory;
import javax.sip.header.Header;
import javax.sip.header.HeaderFactory;
import javax.sip.message.MessageFactory;
import java.text.ParseException;
import java.util.List;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import io.routr.headers.MessageConverter;

public final class RequestSender {
  private static final Logger LOG = LogManager.getLogger(RequestSender.class);
  private MessageFactory messageFactory;
  private HeaderFactory headerFactory;
  private SipProvider sipProvider;
  private AddressFactory addressFactory;

  public RequestSender(RequesterService requesterService, final String bindAddr) {
    try {
      this.messageFactory = SipFactory.getInstance().createMessageFactory();
      this.headerFactory = SipFactory.getInstance().createHeaderFactory();
      this.addressFactory = SipFactory.getInstance().createAddressFactory();
      this.sipProvider = SIPProviderBuilder.createSipProvider(requesterService, bindAddr);
    } catch (PeerUnavailableException | TransportNotSupportedException | ObjectInUseException
        | TransportAlreadySupportedException | InvalidArgumentException e) {
      LOG.fatal("an exception occurred while constructing the class", e);
      System.exit(1);
    }
  }

  public void sendRequest(final SendMessageRequest request)
      throws InvalidArgumentException, ParseException, SipException {

    List<Header> headers = MessageConverter.createHeadersFromMessage(request.getMessage());

    LOG.debug("header list size: {}", headers.size());

    var transport = request.getTransport().toString().toLowerCase();

    var requestStr = !request.getMessage().getRequestUri().getUser().isEmpty() ?
        String.format("%s sip:%s@%s;transport=%s SIP/2.0\r\n\r\n",
            request.getMethod(),
            request.getMessage().getRequestUri().getUser(),
            request.getTarget(),
            transport) :
        String.format("%s sip:%s;transport=%s SIP/2.0\r\n\r\n",
            request.getMethod(),
            request.getTarget(),
            transport);

    var req = this.messageFactory.createRequest(requestStr);

    var lp = this.sipProvider.getListeningPoint(transport);
    var viaHeader = this.headerFactory.createViaHeader(
        lp.getIPAddress(),
        lp.getPort(),
        transport,
        null);
    viaHeader.setRPort();

    var contactAddress = this.addressFactory.createAddress(String.format("sip:%s:%s;transport=%s;bnc",
      lp.getIPAddress(),
      lp.getPort(),
      transport));
  
    var contactHeader = headerFactory.createContactHeader(contactAddress);

    headers.add(contactHeader);
    headers.add(viaHeader);
    headers.forEach(req::addHeader);

    if (!request.getMessage().getBody().isEmpty()) {
      assert req.getHeader(ContentTypeHeader.NAME) != null;
      req.setContent(request.getMessage().getBody(), (ContentTypeHeader) req.getHeader(ContentTypeHeader.NAME));
    }

    LOG.debug("sending request: \n{}", req.toString());

    try {
      var clientTransaction = this.sipProvider.getNewClientTransaction(req);
      clientTransaction.sendRequest();
    } catch (SipException e) {
      LOG.warn("an exception occurred while sending request callId: {}", request.getMessage().getCallId().getCallId(), e);
    }
  }
}

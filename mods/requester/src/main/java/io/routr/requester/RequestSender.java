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

import javax.sip.*;
import javax.sip.header.Header;
import javax.sip.message.MessageFactory;
import java.text.ParseException;
import java.util.List;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import io.routr.headers.MessageConverter;

final public class RequestSender {
  private final static Logger LOG = LogManager.getLogger(RequestSender.class);
  private MessageFactory messageFactory;
  private SipProvider sipProvider;

  public RequestSender(RequesterService requesterService, final String bindAddr, final String proxyAddr) {
    try {
      this.messageFactory = SipFactory.getInstance().createMessageFactory();
      this.sipProvider = SIPProviderBuilder.createSipProvider(requesterService, bindAddr, proxyAddr);
    } catch (PeerUnavailableException | TransportNotSupportedException | ObjectInUseException
             | TransportAlreadySupportedException | InvalidArgumentException e) {
      LOG.error(e.getMessage());
    }
  }

  public void sendRequest(final SendMessageRequest request)
      throws InvalidArgumentException, ParseException, SipException {

    List<Header> headers = MessageConverter.createHeadersFromMessage(request.getMessage());

    LOG.debug("Header list size: {}", headers.size());

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

}

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
package io.routr.requester;

import javax.sip.*;
import java.util.TooManyListenersException;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public class SIPProviderBuilder {
  private final static Logger LOG = LogManager.getLogger(SIPProviderBuilder.class);

  static public SipProvider createSipProvider(final RequesterService requesterService, final String bindAddr)
      throws PeerUnavailableException, TransportNotSupportedException, InvalidArgumentException,
      ObjectInUseException, TransportAlreadySupportedException {

    var sipFactory = SipFactory.getInstance();
    sipFactory.setPathName("gov.nist");

    var sipStack = sipFactory.createSipStack(SIPStackProperties.createProperties());

    final String host = AddressUtil.getHostFromAddress(bindAddr);
    final int port = AddressUtil.getPortFromAddress(bindAddr);

    LOG.info("binding sip listening points to {}:{}" , host, port);

    var lpTCP = (sipStack).createListeningPoint(host, port, "tcp");
    var lpUDP = (sipStack).createListeningPoint(host, port, "udp");
    var sipProvider = (sipStack).createSipProvider(lpTCP);

    sipProvider.addListeningPoint(lpUDP);

    try {
      sipProvider.addSipListener(requesterService);
    } catch (TooManyListenersException e) {
      LOG.fatal("an exception occurred while constructing the class", e);
      System.exit(1);
    }

    return sipProvider;
  }
}

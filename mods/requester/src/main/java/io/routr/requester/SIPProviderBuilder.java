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
import java.util.TooManyListenersException;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public class SIPProviderBuilder {
  private final static Logger LOG = LogManager.getLogger(SIPProviderBuilder.class);

  static public SipProvider createSipProvider(final RequesterService requesterService, final String bindAddr,
      final String proxyAddr)
      throws PeerUnavailableException, TransportNotSupportedException, InvalidArgumentException,
      ObjectInUseException, TransportAlreadySupportedException {

    // TODO: Make this a function parameter
    int port = 7070;

    if (bindAddr.split(":").length == 2) {
      port = Integer.parseInt(bindAddr.split(":")[1]);
    }

    LOG.debug("Binding Requester to " + bindAddr + ":" + port);

    var sipFactory = SipFactory.getInstance();
    sipFactory.setPathName("gov.nist");

    var sipStack = sipFactory.createSipStack(SIPStackProperties.createProperties(proxyAddr));

    // TODO: Make this a configuratable option
    var lpTCP = ((sipStack).createListeningPoint(bindAddr, port, "tcp"));
    var lpUDP = (sipStack).createListeningPoint(bindAddr, port, "udp");
    var sipProvider = (sipStack).createSipProvider(lpTCP);
    sipProvider.addListeningPoint(lpUDP);

    try {
      sipProvider.addSipListener(requesterService);
    } catch (TooManyListenersException e) {
      // TODO: Improve error logging
      // TODO: Should this be a fatal error?
      LOG.warn(e.getMessage());
    }

    return sipProvider;
  }
}

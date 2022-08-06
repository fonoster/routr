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

import io.grpc.Server;
import io.grpc.ServerBuilder;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import java.io.IOException;
import java.text.ParseException;
import java.util.concurrent.TimeUnit;
import javax.sip.InvalidArgumentException;
import javax.sip.SipException;

public class Requester {
  private final static Logger LOG = LogManager.getLogger(Requester.class);
  private final Server server;
  private final RequesterService requesterService;
  private final RequestSender requestSender;

  public Requester(final String proxyAddr, final String bindAddr) {
    this.requesterService = new RequesterService(this);
    this.requestSender = new RequestSender(requesterService, bindAddr, proxyAddr);
    
    // TODO: Make this a configuratable option
    server = ServerBuilder.forPort(50072).addService(requesterService).build();
  }

  public void start() throws IOException {
    server.start();
    // TODO: Take port from config
    LOG.info("Server started, listening on " + 50072);
    Runtime.getRuntime().addShutdownHook(new Thread(() -> {
      // Use stderr here since the logger may have been reset by its JVM shutdown
      // hook.
      LOG.info("*** shutting down gRPC server since JVM is shutting down");
      try {
        Requester.this.stop();
      } catch (InterruptedException e) {
        LOG.error(System.err);
      }
      LOG.info("*** server shut down");
    }));
  }

  public void stop() throws InterruptedException {
    if (server != null) {
      server.shutdown().awaitTermination(30, TimeUnit.SECONDS);
    }
  }

  public void sendRequest(final SendMessageRequest request) throws InvalidArgumentException, ParseException, SipException {
    this.requestSender.sendRequest(request);
  }

}

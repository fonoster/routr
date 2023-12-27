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
package io.routr.events;

import java.util.Map;
import java.io.IOException;
import io.nats.client.Connection;
import io.nats.client.Nats;
import io.nats.client.Options;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public class NATSPublisher implements EventsPublisher {
  private static final Logger LOG = LogManager.getLogger(NATSPublisher.class);
  private Connection connection;
  private String subject;

  public NATSPublisher(final String addr, final String subject) throws IOException, InterruptedException{
    Options options = new Options.Builder().server(addr).build();
    this.connection = Nats.connect(options);
    this.subject = subject;
  }

  public void publish(String eventName, Map<String, Object> message) {
    try {
      ObjectMapper mapper = new ObjectMapper();
      String messageAsJson = mapper.writeValueAsString(message);
      this.connection.publish(this.subject + "." + eventName, messageAsJson.getBytes());
    } catch(JsonProcessingException e) {
        LOG.error("error publishing event: " + e.getMessage());
    }
  }

  public void close() throws InterruptedException {
    this.connection.close();
  }
}

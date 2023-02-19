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

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import org.eclipse.jetty.server.Connector;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.ServerConnector;
import org.eclipse.jetty.servlet.ServletHandler;

import io.routr.HealthCheck;

import java.io.IOException;

public class Launcher {
  private final static Logger LOG = LogManager.getLogger(Launcher.class);

  static public void main(String... args) {
    System.setProperty("serviceName", "requester");
    try {
      var bindAddr = System.getenv().get("BIND_ADDR") != null && !System.getenv().get("BIND_ADDR").isEmpty()
          ? System.getenv().get("BIND_ADDR")
          : "0.0.0.0:51909";
      boolean enableHealthChecks = System.getenv().get("ENABLE_HEALTHCHECKS") != null && !System.getenv().get("ENABLE_HEALTHCHECKS").isEmpty()
          ? Boolean.parseBoolean(System.getenv().get("ENABLE_HEALTHCHECKS"))
          : true;

      new Requester(bindAddr).start();

      if (enableHealthChecks) {
        new HealthCheck(8080).start();
      }
    } catch (Exception e) {
      LOG.fatal(e.getMessage());
      System.exit(1);
    }
  }
}

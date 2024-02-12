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

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import io.routr.HealthCheck;

public class Launcher {
  private static final Logger LOG = LogManager.getLogger(Launcher.class);

  public static void main(String... args) {
    System.setProperty("serviceName", "requester");
    try {
      String bindAddrEnv = System.getenv("BIND_ADDR");
      String bindAddr = bindAddrEnv == null || bindAddrEnv.isEmpty()
          ? "0.0.0.0:51909"
          : bindAddrEnv;

      new Requester(bindAddr).start();

      String healthCheckEnv = System.getenv("ENABLE_HEALTHCHECKS");

      if (Boolean.parseBoolean(healthCheckEnv)) {
        new HealthCheck(8080).start();
      }
    } catch (Exception e) {
      LOG.fatal(e.getMessage());
      System.exit(1);
    }
  }
}

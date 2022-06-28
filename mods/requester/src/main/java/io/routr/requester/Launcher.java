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

import java.io.IOException;

public class Launcher {

  private final static Logger LOG = LogManager.getLogger(Requester.class);

  static public void main(String... args) {
    try {
      var proxyAddr = "192.168.1.3:5060";
      var bindAddr = "192.168.1.3";
      var requester = new Requester(proxyAddr, bindAddr);
      requester.start();
    } catch (IOException e) {
      LOG.warn(e.getMessage());
    }
  }
}
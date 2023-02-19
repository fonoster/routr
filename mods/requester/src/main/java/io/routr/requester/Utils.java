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

import java.io.IOException;
import java.net.ServerSocket;
import java.util.Random;

final public class Utils {

  // @Deprecated
  public static int generatePort(int min, int max) {
    Random random = new Random();
    return random.nextInt(max - min) + min;
  }

  public static int getFreePort() {
    try (ServerSocket socket = new ServerSocket(0)) {
      return socket.getLocalPort();
    } catch (IOException e) {
      throw new IllegalStateException("could not find a free port to start requester service on", e);
    }
  }

  // Create a method to get local IP address
  public static String getLocalIP() {
    try {
      return java.net.InetAddress.getLocalHost().getHostAddress();
    } catch (java.net.UnknownHostException e) {
      throw new IllegalStateException("could not get local ip for requester service", e);
    }
  }
}

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

final public class AddressUtil {

  public static String getHostFromAddress(final String address) {
    if (address.split(":").length != 2) {
      throw new IllegalArgumentException("malformated address; must be ${host}:${port}");
    }
    return address.split(":")[0];
  }

  public static int getPortFromAddress(final String address) {
    if (address.split(":").length != 2) {
      throw new IllegalArgumentException("malformated address; must be ${host}:${port}");
    }
    try {
      return Integer.parseInt(address.split(":")[1]);
    } catch(Exception e) {
      if (e instanceof NumberFormatException) {
        throw new IllegalArgumentException("expects port to be a number");
      }
    }
    return -1;
  }
}

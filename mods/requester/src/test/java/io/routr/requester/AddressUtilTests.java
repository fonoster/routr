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

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class AddressUtilTests {

  @Test
  public void testGetHostAndPortFromAddress() {
    var address = "sip.local:5060";
    assertEquals(5060, AddressUtil.getPortFromAddress(address));
    assertEquals("sip.local", AddressUtil.getHostFromAddress(address));
  }

  @Test
  public void whenMalformedAddress_thenAssertionSucceeds() {
    Exception exception = assertThrows(IllegalArgumentException.class, () -> {
      AddressUtil.getPortFromAddress("sip.local");
    });

    String expectedMessage = "malformated address; must be ${host}:${port}";
    String actualMessage = exception.getMessage();

    assertTrue(actualMessage.contains(expectedMessage));
  }

  @Test
  public void whenMalformedPort_thenAssertionSucceeds() {
    Exception exception = assertThrows(IllegalArgumentException.class, () -> {
      AddressUtil.getPortFromAddress("sip.local:five");
    });

    String expectedMessage = "expects port to be a number";
    String actualMessage = exception.getMessage();

    assertTrue(actualMessage.contains(expectedMessage));
  }
}

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

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.util.Properties;

public class SIPStackPropertiesTests {

  @Test
  public void testCreateProperties() {
    Properties properties = SIPStackProperties.createProperties();
    assertEquals("routr-requester", properties.get("javax.sip.STACK_NAME"));
    assertEquals("logs/debug_log.txt", properties.get("gov.nist.javax.sip.DEBUG_LOG"));
    assertEquals("logs/server_log.txt", properties.get("gov.nist.javax.sip.SERVER_LOG"));
    assertEquals("1048576", properties.get("gov.nist.javax.sip.MAX_MESSAGE_SIZE"));
    assertEquals("true", properties.get("gov.nist.javax.sip.CACHE_CLIENT_CONNECTIONS"));
    assertEquals("gov.nist.javax.sip.stack.NioMessageProcessorFactory", properties.get("gov.nist.javax.sip.MESSAGE_PROCESSOR_FACTORY"));
    assertEquals("false", properties.get("gov.nist.javax.sip.PATCH_SIP_WEBSOCKETS_HEADERS"));
    assertEquals("NONBLOCKING", properties.get("gov.nist.javax.sip.NIO_BLOCKING_MODE"));
    assertEquals("false", properties.get("gov.nist.javax.sip.LOG_MESSAGE_CONTENT"));
    assertEquals("0", properties.get("gov.nist.javax.sip.TRACE_LEVEL"));
    assertEquals("8", properties.get("gov.nist.javax.sip.THREAD_POOL_SIZE"));
    assertEquals("true", properties.get("gov.nist.javax.sip.REENTRANT_LISTENER"));
    assertEquals("OFF", properties.get("javax.sip.AUTOMATIC_DIALOG_SUPPORT"));
  }
}

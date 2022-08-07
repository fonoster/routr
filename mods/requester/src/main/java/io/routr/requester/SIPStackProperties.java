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
import java.util.Properties;

final public class SIPStackProperties {

  static Properties createProperties() {
    var properties = new Properties();
    properties.setProperty("javax.sip.STACK_NAME", "routr-registry");
    // properties.setProperty("javax.sip.OUTBOUND_PROXY", proxyAddr);
    properties.setProperty("gov.nist.javax.sip.TRACE_LEVEL", "LOG4J");
    properties.setProperty("gov.nist.javax.sip.DEBUG_LOG", "logs/debug_log.txt");
    properties.setProperty("gov.nist.javax.sip.SERVER_LOG", "logs/server_log.txt");
    // Guard against denial of service attack.
    properties.setProperty("gov.nist.javax.sip.MAX_MESSAGE_SIZE", "1048576");
    // Drop the client connection after we are done with the transaction.
    properties.setProperty("gov.nist.javax.sip.CACHE_CLIENT_CONNECTIONS", "true");
    properties.setProperty(
      "gov.nist.javax.sip.MESSAGE_PROCESSOR_FACTORY",
      "gov.nist.javax.sip.stack.NioMessageProcessorFactory");
    properties.setProperty(
      "gov.nist.javax.sip.PATCH_SIP_WEBSOCKETS_HEADERS",
      "false");
    properties.setProperty("gov.nist.javax.sip.NIO_BLOCKING_MODE", "NONBLOCKING");
    properties.setProperty("gov.nist.javax.sip.LOG_MESSAGE_CONTENT", "false");
    properties.setProperty("gov.nist.javax.sip.TRACE_LEVEL", "0");
    properties.setProperty("gov.nist.javax.sip.THREAD_POOL_SIZE", "8");
    properties.setProperty("gov.nist.javax.sip.REENTRANT_LISTENER", "true");
    properties.setProperty("javax.sip.AUTOMATIC_DIALOG_SUPPORT", "OFF");
    return properties;
  }
}

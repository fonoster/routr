/*
 * Copyright (C) 2021 by Fonoster Inc (https://fonoster.com)
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
import { EdgePortConfig } from "./types";

/**
 * Returns a Map object with the properties for the server's SipStack.
 * For more options see:
 *  https://github.com/RestComm/jain-sip/blob/master/src/gov/nist/javax/sip/SipStackImpl.java
 */
export default function getServerProperties(config: EdgePortConfig): Map<string, string> {
  const properties = new Map()
  properties.set('javax.sip.STACK_NAME', 'routr')
  properties.set('javax.sip.AUTOMATIC_DIALOG_SUPPORT', 'OFF')
  properties.set(
    'gov.nist.javax.sip.MESSAGE_PROCESSOR_FACTORY',
    'gov.nist.javax.sip.stack.NioMessageProcessorFactory'
  )
  properties.set(
    'gov.nist.javax.sip.PATCH_SIP_WEBSOCKETS_HEADERS',
    'false'
  )
  properties.set('gov.nist.javax.sip.CACHE_CLIENT_CONNECTIONS', 'true')
  properties.set('gov.nist.javax.sip.REENTRANT_LISTENER', 'false')
  properties.set('gov.nist.javax.sip.THREAD_POOL_SIZE', '16')
  properties.set('gov.nist.javax.sip.NIO_BLOCKING_MODE', 'NONBLOCKING')

  // Guard against denial of service attack.
  properties.set('gov.nist.javax.sip.MAX_MESSAGE_SIZE', '1048576')
  properties.set('gov.nist.javax.sip.LOG_MESSAGE_CONTENT', 'false')

  // Default host
  properties.set('javax.sip.IP_ADDRESS', config.spec.bindAddr)

  if (config.spec.securityContext) {
    properties.set(
      'gov.nist.javax.sip.TLS_CLIENT_PROTOCOLS',
      config.spec.securityContext.client.protocols.join()
    )
    // This must be set to 'Disabled' when using WSS
    properties.set(
      'gov.nist.javax.sip.TLS_CLIENT_AUTH_TYPE',
      config.spec.securityContext.client.authType
    )
    properties.set(
      'javax.net.ssl.keyStore',
      config.spec.securityContext.keyStore
    )
    properties.set(
      'javax.net.ssl.trustStore',
      config.spec.securityContext.trustStore
    )
    properties.set(
      'javax.net.ssl.keyStorePassword',
      config.spec.securityContext.keyStorePassword
    )
    properties.set(
      'javax.net.ssl.trustStorePassword',
      config.spec.securityContext.trustStorePassword
    )
    properties.set(
      'javax.net.ssl.keyStoreType',
      config.spec.securityContext.keyStoreType
    )
  }

  return properties
}
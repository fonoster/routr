/**
 * @author Pedro Sanders
 * @since v1
 */
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

module.exports = config => {
  const Properties = Java.type('java.util.Properties')
  const FileInputStream = Java.type('java.io.FileInputStream')
  const properties = new Properties()
  // for more options see:
  // https://github.com/RestComm/jain-sip/blob/master/src/gov/nist/javax/sip/SipStackImpl.java
  properties.setProperty('javax.sip.STACK_NAME', 'routr')
  properties.setProperty('javax.sip.AUTOMATIC_DIALOG_SUPPORT', 'OFF')
  properties.setProperty(
    'gov.nist.javax.sip.MESSAGE_PROCESSOR_FACTORY',
    'gov.nist.javax.sip.stack.NioMessageProcessorFactory'
  )
  properties.setProperty(
    'gov.nist.javax.sip.PATCH_SIP_WEBSOCKETS_HEADERS',
    'false'
  )
  properties.setProperty('gov.nist.javax.sip.CACHE_CLIENT_CONNECTIONS', 'true')
  properties.setProperty('gov.nist.javax.sip.REENTRANT_LISTENER', 'false')
  properties.setProperty('gov.nist.javax.sip.THREAD_POOL_SIZE', '16')
  properties.setProperty('gov.nist.javax.sip.NIO_BLOCKING_MODE', 'NONBLOCKING')

  // Guard against denial of service attack.
  properties.setProperty('gov.nist.javax.sip.MAX_MESSAGE_SIZE', '1048576')
  properties.setProperty('gov.nist.javax.sip.LOG_MESSAGE_CONTENT', 'false')
  //properties.setProperty('gov.nist.javax.sip.TRACE_LEVEL', config.spec.logging.traceLevel)

  // Default host
  properties.setProperty('javax.sip.IP_ADDRESS', config.spec.bindAddr)

  // See https://groups.google.com/forum/#!topic/mobicents-public/U_c7aLAJ_MU for useful info
  if (config.spec.securityContext) {
    properties.setProperty(
      'gov.nist.javax.sip.TLS_CLIENT_PROTOCOLS',
      config.spec.securityContext.client.protocols.join()
    )
    // This must be set to 'Disabled' when using WSS
    properties.setProperty(
      'gov.nist.javax.sip.TLS_CLIENT_AUTH_TYPE',
      config.spec.securityContext.client.authType
    )
    properties.setProperty(
      'javax.net.ssl.keyStore',
      config.spec.securityContext.keyStore
    )
    properties.setProperty(
      'javax.net.ssl.trustStore',
      config.spec.securityContext.trustStore
    )
    properties.setProperty(
      'javax.net.ssl.keyStorePassword',
      config.spec.securityContext.keyStorePassword
    )
    properties.setProperty(
      'javax.net.ssl.keyStoreType',
      config.spec.securityContext.keyStoreType
    )
  }

  try {
    properties.load(new FileInputStream('config/stack.properties'))
    LOG.debug(`core.server_properties [server properties => ${properties}]`)
  } catch (e) {
    LOG.warn(e)
  }

  return properties
}

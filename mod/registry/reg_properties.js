
module.exports = (stackName = 'routr', proxyAddr) => {
    const Properties = Java.type('java.util.Properties')
    const properties = new Properties()
    properties.setProperty('javax.sip.STACK_NAME', stackName)
    properties.setProperty('javax.sip.OUTBOUND_PROXY', proxyAddr)
    properties.setProperty('gov.nist.javax.sip.TRACE_LEVEL', 'LOG4J')
    properties.setProperty('gov.nist.javax.sip.DEBUG_LOG', 'etc/debug_log.txt')
    properties.setProperty('gov.nist.javax.sip.SERVER_LOG', 'etc/server_log.txt')
    // Guard against denial of service attack.
    properties.setProperty('gov.nist.javax.sip.MAX_MESSAGE_SIZE', '1048576')
    // Drop the client connection after we are done with the transaction.
    properties.setProperty('gov.nist.javax.sip.CACHE_CLIENT_CONNECTIONS', 'true')
    properties.setProperty('gov.nist.javax.sip.MESSAGE_PROCESSOR_FACTORY', 'gov.nist.javax.sip.stack.NioMessageProcessorFactory')
    properties.setProperty('gov.nist.javax.sip.PATCH_SIP_WEBSOCKETS_HEADERS', 'false')
    properties.setProperty('gov.nist.javax.sip.NIO_BLOCKING_MODE', 'NONBLOCKING')
    properties.setProperty('gov.nist.javax.sip.LOG_MESSAGE_CONTENT', 'false')
    properties.setProperty('gov.nist.javax.sip.TRACE_LEVEL', '0')
    properties.setProperty('gov.nist.javax.sip.THREAD_POOL_SIZE', '8')
    properties.setProperty('gov.nist.javax.sip.REENTRANT_LISTENER', 'true')
    properties.setProperty('javax.sip.AUTOMATIC_DIALOG_SUPPORT', 'OFF')
    return properties
}

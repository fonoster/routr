/**
 * @author Pedro Sanders
 * @since v1
 */
module.exports.connectionException = (e, host) => {
    const LogManager = Java.type('org.apache.logging.log4j.LogManager')
    const LOG = LogManager.getLogger()
    if (e instanceof Java.type('javax.sip.TransactionUnavailableException') ||
        e instanceof Java.type('java.net.ConnectException') ||
        e instanceof Java.type('java.net.NoRouteToHostException') ||
        e instanceof Java.type('java.net.UnknownHostException') ||
        e.toString().includes('IO Exception occured while Sending Request') ||
        e.toString().includes('Could not create a message channel for')) {
        LOG.warn(`Unable to connect to host -> \`${host}\`.(Verify your network status)`)
    } else {
        LOG.error(e)
        e.printStackTrace()
    }
}

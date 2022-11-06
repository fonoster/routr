/**
 * @author Pedro Sanders
 * @since v1
 */
const System = Java.type('java.lang.System')
const FluentLogger = Java.type('org.fluentd.logger.FluentLogger')
const HashMap = Java.type('java.util.HashMap')
const Response = Java.type('javax.sip.message.Response')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const StringWriter = Java.type('java.io.StringWriter')
const PrintWriter = Java.type('java.io.PrintWriter')
const LOG = LogManager.getLogger(Java.type('io.routr.core.Launcher'))
const uLOG = FluentLogger.getLogger(
  'user',
  System.getenv('LOGS_DRIVER_HOST') || 'localhost',
  System.getenv('LOGS_DRIVER_PORT')
    ? parseInt(System.getenv('LOGS_DRIVER_PORT'))
    : 24224
)

function sendUserLog (log) {
  const data = new HashMap()
  const body = new HashMap()
  body.put('address', log.gwHost)
  body.put('transport', log.transport)
  body.put('requestMethod', log.requestMethod)
  body.put('gatewayRef', log.gwRef)
  body.put('numberRef', log.numberRef)
  body.put('number', log.number)
  data.put('accessKeyId', log.accessKeyId)
  data.put('eventType', 'sip')
  data.put('level', 'error')
  data.put('message', log.message)
  data.put('body', body)
  uLOG.log('follow', data)
  LOG.debug('User log => ' + log)
}

module.exports.connectionException = (e, host, transaction, route) => {
  const { sendResponse } = require('@routr/core/processor/processor_utils')
  let isInternal = false
  if (
    e instanceof Java.type('javax.sip.TransactionUnavailableException') ||
    e instanceof Java.type('java.net.ConnectException') ||
    e instanceof Java.type('java.net.NoRouteToHostException') ||
    e instanceof Java.type('java.net.UnknownHostException') ||
    e.toString().includes('IO Exception occured while Sending Request') ||
    e.toString().includes('Could not create a message channel for')
  ) {
    if (transaction) {
      sendResponse(transaction, Response.TEMPORARILY_UNAVAILABLE)
    }
    LOG.warn(
      `Unable to connect to host -> \`${host}\`.(Verify your network status)`
    )
  } else {
    if (transaction) {
      sendResponse(transaction, Response.SERVER_INTERNAL_ERROR)
    }

    const sw = new StringWriter()
    const pw = new PrintWriter(sw)
    e.printStackTrace(new PrintWriter(sw))
    LOG.error(sw.toString())
    pw.close()

    isInternal = true
  }

  if (transaction && route && route.accessKeyId) {
    const message = isInternal
      ? 'We are having trouble with our service (please try again later)'
      : 'We are unable to communicate with your sip endpoint (please verify that your endpoint is correct and that is reachable)'
    sendUserLog({
      accessKeyId: route.accessKeyId,
      host,
      requestMethod: transaction?.getRequest().getMethod(),
      transport: route.transport,
      gwRef: route.gwRef,
      gwHost: route.gwHost,
      numberRef: route.numberRef,
      number: route.number,
      thruGw: route.thruGw,
      message
    })
  }
}

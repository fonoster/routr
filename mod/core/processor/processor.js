/**
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')
const RequestProcessor = require('@routr/core/processor/request_processor')
const ResponseProcessor = require('@routr/core/processor/response_processor')
const CallIdHeader = Java.type('javax.sip.header.CallIdHeader')
const FromHeader = Java.type('javax.sip.header.FromHeader')
const ToHeader = Java.type('javax.sip.header.ToHeader')
const UserAgentHeader = Java.type('javax.sip.header.UserAgentHeader')
const SipListener = Java.type('javax.sip.SipListener')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger(Java.type('io.routr.core.Launcher'))
const HashMap = Java.type('java.util.HashMap')
const config = require('@routr/core/config_util')()
const TelemetryClient = Java.type(
  'com.microsoft.applicationinsights.TelemetryClient'
)
const telemetryClient = new TelemetryClient()
const toCamelCase = str =>
  str.substring(0, 1).toUpperCase() + str.substring(1).toLowerCase()

const getEventProperties = message => {
  const eventProperties = new HashMap()
  eventProperties.put('SipServerVersion', config.system.version)
  eventProperties.put(
    'SipCallId',
    message.getHeader(CallIdHeader.NAME).getCallId()
  )
  eventProperties.put(
    'SipTo',
    message
      .getHeader(FromHeader.NAME)
      .getAddress()
      .getURI().toString()
  )
  eventProperties.put(
    'SipFrom',
    message
      .getHeader(ToHeader.NAME)
      .getAddress()
      .getURI().toString()
  )
  const userAgent = message.getHeader(UserAgentHeader.NAME)
  if (userAgent) {
    eventProperties.put('SipUserAgent', userAgent.getProduct().next())
  } else {
    eventProperties.put('SipUserAgent', 'Unknown')
  }
  return eventProperties
}

class Processor {
  constructor(sipProvider, dataAPIs, contextStorage) {
    this.requestProcessor = new RequestProcessor(
      sipProvider,
      dataAPIs,
      contextStorage
    )
    this.responseProcessor = new ResponseProcessor(sipProvider, contextStorage)
  }

  get listener() {
    return new SipListener({
      processRequest: event => {
        try {
          const eventProperties = getEventProperties(event.getRequest())
          const eventName = 'RoutrRequest' + toCamelCase(event.getRequest().getMethod().toString())
          const startTime = System.currentTimeMillis()
          this.requestProcessor.process(event)
          const endTime = System.currentTimeMillis()
          const metricName = `sip.routr.request.${event
            .getRequest()
            .getMethod()
            .toLowerCase()}.duration`
          telemetryClient.trackMetric(metricName, endTime - startTime)
          telemetryClient.trackEvent(eventName, eventProperties, null)
        } catch (e) {
          LOG.error(e.message || e)
        }
      },

      processResponse: event => {
        try {
          const eventProperties = getEventProperties(event.getResponse())
          const eventName = 'RoutrResponse' + event.getResponse().getStatusCode()     
          const startTime = System.currentTimeMillis()
          this.responseProcessor.process(event)
          const endTime = System.currentTimeMillis()
          const metricName = `sip.routr.response.${event
            .getResponse()
            .getStatusCode()}.duration`
          telemetryClient.trackMetric(metricName, endTime - startTime)
          telemetryClient.trackEvent(eventName, eventProperties, null)
        } catch (e) {
          LOG.error(e.message || e)
        }
      },

      processTimeout: event => {
        const transactionId = event.isServerTransaction()
          ? event.getServerTransaction().getBranchId()
          : event.getClientTransaction().getBranchId()
        postal.publish({
          channel: 'processor',
          topic: 'transaction.timeout',
          data: {
            transactionId,
            isServerTransaction: event.isServerTransaction()
          }
        })
      },

      processTransactionTerminated: event => {
        const request = event.getServerTransaction().getRequest()
        const callId = request.getHeader(CallIdHeader.NAME).getCallId()
        const fromTag = request.getHeader(FromHeader.NAME).getTag()

        const transactionId = event.isServerTransaction()
          ? event.getServerTransaction().getBranchId()
          : event.getClientTransaction().getBranchId()

        postal.publish({
          channel: 'processor',
          topic: 'transaction.terminated',
          data: {
            transactionId,
            isServerTransaction: event.isServerTransaction(),
            callId,
            fromTag
          }
        })
      },

      processDialogTerminated: event => {
        postal.publish({
          channel: 'processor',
          topic: 'dialog.terminated',
          data: {
            dialogId: event.getDialog().getDialogId()
          }
        })
      }
    })
  }
}

module.exports = Processor

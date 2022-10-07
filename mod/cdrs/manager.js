/**
 * Stores in memory information about sip transactions.
 *
 * @author Pedro Sanders
 * @since v1
 */
const config = require('@routr/core/config_util')()
const postal = require('postal')
const getTerminationCause = require('@routr/cdrs/termination_cause')
const getCodec = require('@routr/cdrs/codecs')
const getExtraHeaders = require('@routr/cdrs/extra_headers')
const EventsHandler = require('@routr/cdrs/events_handler')
const RTPEngineConnector = require('@routr/rtpengine/connector')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const CallIdHeader = Java.type('javax.sip.header.CallIdHeader')
const FromHeader = Java.type('javax.sip.header.FromHeader')
const ToHeader = Java.type('javax.sip.header.ToHeader')
const LOG = LogManager.getLogger(Java.type('io.routr.core.Launcher'))
const System = Java.type('java.lang.System')

class CDRSManager {
  constructor () {
    LOG.info('Starting CDRS Manager')
    postal.subscribe({
      channel: 'processor',
      topic: 'call.started',
      callback: data => this.processCallStartEvent(data.request)
    })

    postal.subscribe({
      channel: 'processor',
      topic: 'call.end',
      callback: data => this.processCallEndEvent(data.request)
    })

    postal.subscribe({
      channel: 'processor',
      topic: 'transaction.terminated',
      callback: data => this.processCallEndEvent(data)
    })

    this.store = new Map()
    new EventsHandler()
    if (config.spec.ex_rtpEngine.enabled) {
      this.rtpeConnector = new RTPEngineConnector(config.spec.ex_rtpEngine)
    }
  }

  processCallStartEvent (request) {
    LOG.debug('Processing call.started event')
    const fromAddress = request
      .getHeader(FromHeader.NAME)
      .getAddress()
      .getURI()
    const toAddress = request
      .getHeader(ToHeader.NAME)
      .getAddress()
      .getURI()
    // const codec = getCodec(String.fromCharCode.apply(null, request.getContent()))
    const codec = getCodec(request.getContent())

    const cdr = {
      callId: request.getHeader(CallIdHeader.NAME).getCallId(),
      from: `${fromAddress.getUser()}@${fromAddress.getHost()}`,
      to: `${toAddress.getUser()}@${toAddress.getHost()}`,
      startTime: new Date(),
      gatewayRef: request.getHeader('X-Gateway-Ref')?.value || '',
      gatewayHost: request.getRequestURI().getHost(),
      routrInstance: System.getenv('HOSTNAME'),
      codec,
      extraHeaders: getExtraHeaders(request)
    }
    this.store.set(cdr.callId, cdr)

    postal.publish({
      channel: 'cdrs',
      topic: 'cdr.started',
      data: {
        cdr
      }
    })
  }

  validateSSN (ssn) {
    return ssn && ssn.length === 9 && !isNaN(ssn)
  }

  // TODO: Get qos or not available (hard) need instance to RTPEngine
  async processCallEndEvent (request) {
    LOG.debug('Processing call.end event')
    const callId = request.getHeader(CallIdHeader.NAME).getCallId()

    // If the request method is not BYE, then we should mark this as unknown
    const terminationCode =
      request.getHeader('X-Asterisk-HangupCauseCode')?.value || -1
    const startCdr = this.store.get(callId)
    const qos = (await this.rtpeConnector?.getQoS(callId)) || {}

    if (startCdr) {
      const cdr = {
        callId: startCdr.callId,
        from: startCdr.from,
        to: startCdr.to,
        startTime: startCdr.startTime,
        endTime: new Date(),
        duration: (new Date() - startCdr.startTime) / 1000,
        gatewayRef: startCdr.gatewayRef,
        gatewayHost: startCdr.gatewayHost,
        routrInstance: startCdr.routrInstance,
        terminationCause: getTerminationCause(terminationCode),
        terminationCode: terminationCode,
        codec: startCdr.codec,
        qos,
        extraHeaders: startCdr.extraHeaders
      }

      this.store.delete(callId)

      postal.publish({
        channel: 'cdrs',
        topic: 'cdr.complete',
        data: {
          cdr
        }
      })
    }
  }
}

module.exports = CDRSManager

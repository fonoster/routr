/**
 * Stores in memory information about sip transactions.
 *
 * @author Pedro Sanders
 * @since v1
 */
const { isMethod } = require('../core/processor/processor_utils')
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
const Request = Java.type('javax.sip.message.Request')
const LOG = LogManager.getLogger(Java.type('io.routr.core.Launcher'))
const System = Java.type('java.lang.System')

class CDRSManager {
  constructor () {
    postal.subscribe({
      channel: 'processor',
      topic: 'call.started',
      callback: data => this.processCallStartEvent(data.request)
    })

    postal.subscribe({
      channel: 'processor',
      topic: 'call.end',
      callback: data => this.processCallEndEvent(data.request, data.response)
    })

    postal.subscribe({
      channel: 'processor',
      topic: 'transaction.cancel',
      callback: data => {
        this.processCallEndEvent(data.transaction.getRequest())
      }
    })

    this.store = new Map()

    new EventsHandler()
    if (config.spec.ex_rtpEngine.enabled) {
      this.rtpeConnector = new RTPEngineConnector(config.spec.ex_rtpEngine)
    }
  }

  processCallStartEvent (request) {
    const callId = request.getHeader(CallIdHeader.NAME).getCallId()
    const startCdr = this.store.get(callId)

    if (startCdr) {
      // Avoid duplicating cdr
      return
    }

    LOG.debug(`cdrs.manager processing call.started event [callId = ${callId}]`)

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
      from: `sip:${fromAddress.getUser()}@${fromAddress.getHost()}`,
      to: `sip:${toAddress.getUser()}@${toAddress.getHost()}`,
      startTime: new Date(),
      gatewayRef: request.getHeader('X-Gateway-Ref')?.value || '',
      gatewayHost: request.getRequestURI().getHost(),
      routrInstance: System.getenv('HOSTNAME'),
      codec,
      extraHeaders: getExtraHeaders(request)
    }

    if (request.getHeader('X-Access-Key-Id')?.value) {
      cdr.accessKeyId = request.getHeader('X-Access-Key-Id')?.value
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

  // TODO: Get qos or not available (hard) need instance to RTPEngine
  async processCallEndEvent (request, response) {
    const callId = request.getHeader(CallIdHeader.NAME).getCallId()
    LOG.debug(`cdrs.manager processing call.end event [callId = ${callId}]`)

    let terminationCode = -1

    if (response) {
      // Mapping response SIP reject to ISDN reject
      terminationCode =
        response.getStatusCode() === 603 ? 21 : response.getStatusCode()
    } else if (isMethod(request, [Request.CANCEL])) {
      terminationCode = 16
    } else if (request.getHeader('X-Asterisk-HangupCauseCode')?.value) {
      terminationCode = request.getHeader('X-Asterisk-HangupCauseCode')?.value
    } else if (isMethod(request, [Request.BYE])) {
      // Keep it in this order
      terminationCode = 16
    }

    const startCdr = this.store.get(callId)
    const qos = (await this.rtpeConnector?.getQoS(callId)) || {}

    if (startCdr) {
      const cdr = {
        ...startCdr,
        endTime: new Date(),
        duration: (new Date() - startCdr.startTime) / 1000,
        terminationCause: getTerminationCause(terminationCode),
        terminationCode: terminationCode,
        qos
      }

      this.store.delete(callId)

      postal.publish({
        channel: 'cdrs',
        topic: 'cdr.complete',
        data: {
          cdr
        }
      })
      return
    }
    LOG.debug('cdrs.manager no startCdr found; ignoring call.end event')
  }
}

module.exports = CDRSManager

/**
 * @author Pedro Sanders
 * @since v1
 */
const System = Java.type('java.lang.System')
const postal = require('postal')
const DSSelector = require('@routr/data_api/ds_selector')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const {
  isStackJob,
  isTransactional,
  mustAuthenticate,
  handleAuthChallenge,
  hasSDP,
  extractRTPEngineParams,
  isOk
} = require('@routr/core/processor/processor_utils')
const RTPEngineConnector = require('@routr/rtpengine/connector')
const Request = Java.type('javax.sip.message.Request')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const CSeqHeader = Java.type('javax.sip.header.CSeqHeader')
const ContentTypeHeader = Java.type('javax.sip.header.ContentTypeHeader')
const SipFactory = Java.type('javax.sip.SipFactory')
const headerFactory = SipFactory.getInstance().createHeaderFactory()
const { RTPBridgingNote } = require('@routr/rtpengine/rtp_bridging_note')
const { directionFromResponse } = require('@routr/rtpengine/utils')
const { isMethod } = require('./processor_utils')
const config = require('@routr/core/config_util')()
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger(Java.type('io.routr.core.Launcher'))
const FluentLogger = Java.type('org.fluentd.logger.FluentLogger')
const HashMap = Java.type('java.util.HashMap')
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
  body.put('code', log.code)
  body.put('error', log.error)
  data.put('accessKeyId', log.accessKeyId)
  data.put('eventType', 'sip')
  data.put('level', 'error')
  data.put('message', log.message)
  data.put('body', body)
  uLOG.log('logs', data)
}

class ResponseProcessor {
  constructor (sipProvider, contextStorage) {
    this.sipProvider = sipProvider
    this.contextStorage = contextStorage
    this.gatewaysAPI = new GatewaysAPI(DSSelector.getDS(config))
    if (config.spec.ex_rtpEngine.enabled) {
      this.rtpeConnector = new RTPEngineConnector(config.spec.ex_rtpEngine)
    }
  }

  process (event) {
    if (isStackJob(event.getResponse())) {
      return
    }

    const response = event.getResponse()

    // If it is not transactional and authentication is required it means
    // that the REGISTER request was originated by another sipStack
    if (mustAuthenticate(response) && isTransactional(event)) {
      LOG.debug('core.processor.ResponseProcessor.process [must authenticate]')
      LOG.debug(response)

      const gwRef = event
        .getClientTransaction()
        .getRequest()
        .getHeader('X-Gateway-Ref').value
      const gw = this.gatewaysAPI.getGateway(gwRef).data

      if (gw?.spec?.credentials?.username && gw?.spec?.credentials?.secret) {
        handleAuthChallenge(this.sipProvider.getSipStack(), event, gw)
        return
      }
    }

    // Mark call as ended if response to invite with code >= 3xx (redirection responses)
    if (
      isMethod(response, [Request.INVITE]) &&
      response.getStatusCode() >= 300
    ) {
      postal.publish({
        channel: 'processor',
        topic: 'call.end',
        data: {
          request: event.getClientTransaction().getRequest(),
          response
        }
      })
    }

    this.sendResponse(event)
  }

  async sendResponse (event) {
    LOG.debug(
      'core.processor.ResponseProcessor.sendResponse [Inconming response <=]'
    )
    LOG.debug(event.getResponse())
    const appData = event.getClientTransaction()?.getApplicationData()

    let response = event.getResponse().clone()

    // Gateway calls using the handleAuthChallenge must compensate and reduce the CSeq 
    // before sending back the response to match the original request.
    if (appData?.thruGw && appData?.gwUsername) {
      const cseq = response.getHeader(CSeqHeader.NAME).getSeqNumber() - 1
      response.getHeader(CSeqHeader.NAME).setSeqNumber(cseq)
    }

    if (event.getResponse().getStatusCode() >= 400 && appData?.accessKeyId) {
      appData.message = `The call was rejected by the sip endpoint with error code ${event
        .getResponse()
        .getStatusCode()} (${event.getResponse().getReasonPhrase()})`
      appData.code = event.getResponse().getStatusCode()
      appData.error = event.getResponse().getReasonPhrase()
      appData.requestMethod = event
        .getResponse()
        .getHeader(CSeqHeader.NAME)
        .getMethod()
      sendUserLog(appData)
    }

    try {
      let bridgingNote
      if (
        config.spec.ex_rtpEngine.enabled &&
        (isOk(response) || response.getStatusCode() === 183) &&
        hasSDP(response)
      ) {
        bridgingNote = directionFromResponse(response)
        const obj = await this.rtpeConnector.answer(
          bridgingNote,
          extractRTPEngineParams(response)
        )
        response.setContent(obj.sdp, response.getHeader(ContentTypeHeader.NAME))
      }

      // WARNINIG: We need to remove the SDP for response to WebRTC endpoints
      // else we will get the error "Called with SDP without DTLS fingerprint"
      if (
        config.spec.ex_rtpEngine.enabled &&
        response.getStatusCode() === 183 &&
        bridgingNote === RTPBridgingNote.WEB_TO_SIP
      ) {
        LOG.debug(
          'core.processor.ResponseProcessor.sendResponse [Removing SDP from 183 response]'
        )
        response.removeContent()
      }

      const viaHeader = response.getHeader(ViaHeader.NAME)
      const xReceivedHeader = headerFactory.createHeader(
        'X-Inf-Received',
        viaHeader.getReceived()
      )
      const xRPortHeader = headerFactory.createHeader(
        'X-Inf-RPort',
        `${viaHeader.getRPort()}`
      )
      response.addHeader(xReceivedHeader)
      response.addHeader(xRPortHeader)
      response.removeFirst(ViaHeader.NAME)

      if (isTransactional(event)) {
        const context = this.contextStorage.findContext(
          event.getClientTransaction().getBranchId()
        )
        if (context && context.serverTransaction) {
          context.serverTransaction.sendResponse(response)
        } else if (response.getHeader(ViaHeader.NAME) !== null) {
          this.sipProvider.sendResponse(response)
        }
      } else if (response.getHeader(ViaHeader.NAME) !== null) {
        // Could be a BYE due to Record-Route
        this.sipProvider.sendResponse(response)
      }
      LOG.debug(
        'core.processor.ResponseProcessor.sendResponse [Outgoing response => ]'
      )
      LOG.debug(response)
    } catch (e) {
      LOG.error(e.message || e)
    }
  }
}

module.exports = ResponseProcessor

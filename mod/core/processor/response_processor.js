/**
 * @author Pedro Sanders
 * @since v1
 */
const DSSelector = require('@routr/data_api/ds_selector')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const {
  isStackJob,
  isTransactional,
  mustAuthenticate,
  handleAuthChallenge
} = require('@routr/core/processor/processor_utils')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const SipFactory = Java.type('javax.sip.SipFactory')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()
const headerFactory = SipFactory.getInstance().createHeaderFactory()

class ResponseProcessor {
  constructor (sipProvider, contextStorage) {
    this.sipProvider = sipProvider
    this.contextStorage = contextStorage
    this.gatewaysAPI = new GatewaysAPI(DSSelector.getDS())
  }

  process (event) {
    if (isStackJob(event.getResponse())) {
      return
    }
    // If it is not transactional and athentication is required it means
    // that the REGISTER request was originated by another sipStack
    if (mustAuthenticate(event.getResponse()) && isTransactional(event)) {
      const gwRef = event
        .getClientTransaction()
        .getRequest()
        .getHeader('X-Gateway-Ref').value
      const r = this.gatewaysAPI.getGateway(gwRef)
      handleAuthChallenge(this.sipProvider.getSipStack(), event, r.data)
      return
    }
    this.sendResponse(event)
  }

  sendResponse (event) {
    const response = event.getResponse().clone()
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
    LOG.debug(response)
  }
}

module.exports = ResponseProcessor

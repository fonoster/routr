/**
 * @author Pedro Sanders
 * @since v1
 */
const { connectionException } = require('@routr/utils/exception_helpers')
const SipFactory = Java.type('javax.sip.SipFactory')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const MaxForwardsHeader = Java.type('javax.sip.header.MaxForwardsHeader')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger(Java.type('io.routr.core.Launcher'))
const headerFactory = SipFactory.getInstance().createHeaderFactory()

class RegistryHandler {
  constructor (sipProvider) {
    this.sipProvider = sipProvider
  }

  doProcess (transaction) {
    const request = transaction.getRequest().clone()
    const transport = request
      .getHeader(ViaHeader.NAME)
      .getTransport()
      .toLowerCase()
    const lp = this.sipProvider.getListeningPoint(transport)
    const localAddr = {
      host: lp.getIPAddress().toString(),
      port: lp.getPort()
    }

    this.configureGeneral(request, localAddr)

    LOG.debug(
      `core.processor.RegistryHandler.doProcess [via addr ${JSON.stringify(
        localAddr
      )}]`
    )

    new Promise((resolve, reject) => {
      try {
        this.sipProvider.sendRequest(request)
        resolve()
      } catch (e) {
        reject(e)
        connectionException(e, request.getRequestURI().getHost(), transaction)
      }
    })
  }

  configureGeneral (request, viaAddr) {
    const transport = request
      .getHeader(ViaHeader.NAME)
      .getTransport()
      .toLowerCase()
    const viaHeader = headerFactory.createViaHeader(
      viaAddr.host,
      viaAddr.port,
      transport,
      null
    )
    viaHeader.setRPort()
    request.addFirst(viaHeader)
    const maxForwardsHeader = request.getHeader(MaxForwardsHeader.NAME)
    maxForwardsHeader.decrementMaxForwards()
  }
}

module.exports = RegistryHandler

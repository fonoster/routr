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
const BAD_HOST_QUARANTINE_TIME = 15 * 60

export const quarentine = r =>
  BAD_HOST_QUARANTINE_TIME - (Date.now() - r.entryTime) / 1000 > 0

class RegistryHandler {
  constructor (sipProvider) {
    this.sipProvider = sipProvider
    this.quanrentineHosts = []
  }

  doProcess (transaction) {
    this.quanrentineHosts = this.quanrentineHosts.filter(quarentine)

    LOG.debug(
      'List of gateways in quarantine: ' +
        JSON.stringify(this.quanrentineHosts)
    )
    const isInQuarentine = host =>
      this.quanrentineHosts.filter(q => q.host === host).length > 0

    // if current host is quarentine ignore request
    if (
      isInQuarentine(
        transaction
          .getRequest()
          .getRequestURI()
          .getHost()
      )
    ) {
      const checkAgain = new Date(Date.now() + BAD_HOST_QUARENTINE_TIME * 1000)
      LOG.debug(
        'Host ' +
          transaction
            .getRequest()
            .getRequestURI()
            .getHost() +
          ' is quarentine [will try again after ' +
          checkAgain +
          ']'
      )
      return
    }

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

    try {
      this.sipProvider.sendRequest(request)
    } catch (e) {
      if (
        !isInQuarentine(
          transaction
            .getRequest()
            .getRequestURI()
            .getHost()
        )
      ) {
        this.quanrentineHosts.push({
          host: request.getRequestURI().getHost(),
          entryTime: Date.now()
        })
      }
      connectionException(e, request.getRequestURI().getHost(), transaction)
    }
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

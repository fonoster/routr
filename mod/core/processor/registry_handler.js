/**
 * @author Pedro Sanders
 * @since v1
 */
const {
    connectionException
} = require('@routr/utils/exception_helpers')
const SipFactory = Java.type('javax.sip.SipFactory')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const MaxForwardsHeader = Java.type('javax.sip.header.MaxForwardsHeader')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()
const headerFactory = SipFactory.getInstance().createHeaderFactory()

class RegistryHandler {

    constructor(sipProvider) {
        this.sipProvider = sipProvider
    }

    doProcess(requestIn) {
        const requestOut = requestIn.clone()
        const transport = requestIn.getHeader(ViaHeader.NAME).getTransport().toLowerCase()
        const lp = this.sipProvider.getListeningPoint(transport)
        const localAddr = {
            host: lp.getIPAddress().toString(),
            port: lp.getPort()
        }

        this.configureGeneral(requestOut, localAddr)

        LOG.debug(`core.processor.RegistryHandler.doProcess [via addr ${JSON.stringify(localAddr)}]`)

        try {
            this.sipProvider.sendRequest(requestOut)
        } catch (e) {
            connectionException(e, requestOut.getRequestURI().getHost())
        }
    }

    configureGeneral(request, viaAddr) {
        const transport = request.getHeader(ViaHeader.NAME).getTransport().toLowerCase()
        const viaHeader = headerFactory
            .createViaHeader(viaAddr.host, viaAddr.port, transport, null)
        viaHeader.setRPort()
        request.addFirst(viaHeader)
        const maxForwardsHeader = request.getHeader(MaxForwardsHeader.NAME)
        maxForwardsHeader.decrementMaxForwards()
    }

}

module.exports = RegistryHandler

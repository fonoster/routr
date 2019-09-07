/**
 * @author Pedro Sanders
 * @since v1
 */

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
        } catch(e) {
            if (e instanceof Java.type('javax.sip.TransactionUnavailableException') ||
                e instanceof Java.type('java.net.ConnectException')                 ||
                e instanceof Java.type('java.net.NoRouteToHostException')           ||
                e.toString().includes('Could not create a message channel for')) {
                LOG.warn(`Unable to register to Gateway -> \`${requestOut.getRequestURI().getHost()}\`.(Verify your network status)`)
                return
            }
            LOG.error(e)
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

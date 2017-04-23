/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/utils/auth_helper.js')
load('mod/core/context.js')

function RegistryHelper(sipProvider, headerFactory, messageFactory, addressFactory) {
    const LogManager = Packages.org.apache.logging.log4j.LogManager
    const LOG = LogManager.getLogger()
    const SipUtils = Packages.gov.nist.javax.sip.Utils
    const Request = Packages.javax.sip.message.Request

    var cseq = 0

    this.requestChallenge = (username, peerHost, transport = 'udp', expires = 300) => {
        const host = sipProvider.getListeningPoint(transport).getIPAddress()
        const port = sipProvider.getListeningPoint(transport).getPort()

        cseq++

        const viaHeaders = []
        const viaHeader = headerFactory.createViaHeader(host, port, transport, null)
        // Request RPort for Symmetric Response Routing in accordance with RFC 3581
        viaHeader.setRPort()
        viaHeaders.push(viaHeader)

        const maxForwardsHeader = headerFactory.createMaxForwardsHeader(70)
        const callIdHeader = sipProvider.getNewCallId()
        const cSeqHeader = headerFactory.createCSeqHeader(cseq, Request.REGISTER)
        const fromAddress = addressFactory.createAddress('sip:' + username + '@' + peerHost)
        const fromHeader = headerFactory.createFromHeader(fromAddress, new SipUtils().generateTag())
        const toHeader = headerFactory.createToHeader(fromAddress, null)
        const expireHeader = headerFactory.createExpiresHeader(expires)
        const contactAddress = addressFactory.createAddress('sip:' + username + '@' + host + ':' + port)
        const contactHeader = headerFactory.createContactHeader(contactAddress)

        const request = messageFactory.createRequest('REGISTER sip:' + peerHost + ' SIP/2.0\r\n\r\n')
        request.addHeader(viaHeader)
        request.addHeader(maxForwardsHeader)
        request.addHeader(callIdHeader)
        request.addHeader(cSeqHeader)
        request.addHeader(fromHeader)
        request.addHeader(toHeader)
        request.addHeader(contactHeader)
        request.addHeader(headerFactory.createAllowHeader('INVITE'))
        request.addHeader(headerFactory.createAllowHeader('ACK'))
        request.addHeader(headerFactory.createAllowHeader('BYE'))
        request.addHeader(headerFactory.createAllowHeader('CANCEL'))
        request.addHeader(headerFactory.createAllowHeader('REGISTER'))
        request.addHeader(headerFactory.createAllowHeader('OPTIONS'))
        request.addHeader(expireHeader)


        try {
            const clientTransaction = sipProvider.getNewClientTransaction(request)
            clientTransaction.sendRequest()
        } catch(e) {
            if(e instanceof javax.sip.TransactionUnavailableException || e instanceof javax.sip.SipException) {
                LOG.warn('Unable to register with GW -> ' + peerHost + '. (Verify your network status)')
            } else {
                LOG.warn(e)
            }
        }

        LOG.debug('------->\n' + request)
    }
}
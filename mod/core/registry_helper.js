/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/utils/auth_helper.js')

function RegistryUtil(sipProvider, headerFactory, messageFactory, addressFactory, contactHeader, config) {
    const LogManager = Packages.org.apache.logging.log4j.LogManager
    const LOG = LogManager.getLogger()
    const SipUtils = Packages.gov.nist.javax.sip.Utils
    const Request = Packages.javax.sip.message.Request

    var cseq = 0

    this.requestChallenge = (username, peerHost, transport = 'tcp', expires = 300) => {
        let port
        if (transport == 'tcp') port = config.tcpPort
        if (transport == 'udp') port = config.udpPort
        if (transport == 'ws') port = config.wsPort

        cseq++
        const viaHeaders = []
        const viaHeader = headerFactory.createViaHeader(config.ip, port, transport, null)
        viaHeaders.push(viaHeader)

        const maxForwardsHeader = headerFactory.createMaxForwardsHeader(70)
        const callIdHeader = sipProvider.getNewCallId()
        const cSeqHeader = headerFactory.createCSeqHeader(cseq, Request.REGISTER)
        const fromAddress = addressFactory.createAddress('sip:' + username + '@' + peerHost)
        const fromHeader = headerFactory.createFromHeader(fromAddress, new SipUtils().generateTag())
        const toHeader = headerFactory.createToHeader(fromAddress, null)
        const expireHeader = headerFactory.createExpiresHeader(expires)
        const contactAddress = addressFactory.createAddress('sip:' + username + '@' + config.ip + ':' + port)
        const contactHeader = headerFactory.createContactHeader(contactAddress)

        const request = messageFactory.createRequest('REGISTER sip:' + peerHost + ' SIP/2.0\r\n\r\n')
        request.addHeader(callIdHeader)
        request.addHeader(cSeqHeader)
        request.addHeader(fromHeader)
        request.addHeader(toHeader)
        request.addHeader(maxForwardsHeader)
        request.addHeader(viaHeader)        // Warning: Should we add the array?
        request.addHeader(contactHeader)
        request.addHeader(expireHeader)

        try {
            const ct = sipProvider.getNewClientTransaction(request)
            ct.sendRequest()
        } catch(e) {
            if(e instanceof javax.sip.TransactionUnavailableException || e instanceof javax.sip.SipException) {
                LOG.warn('Unable to register with GW -> ' + peerHost + '. (Verify your network status)')
            } else {
                LOG.warn(e)
            }
        }
    }
}
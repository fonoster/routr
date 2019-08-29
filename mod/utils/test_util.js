

module.exports.createRequest = function(from, to, withExpiresInContact = false) {
    const SipFactory = Java.type('javax.sip.SipFactory')
    const SipUtils = Java.type('gov.nist.javax.sip.Utils')
    const Request = Java.type('javax.sip.message.Request')
    const ArrayList = Java.type('java.util.ArrayList')
    const sipFactory = SipFactory.getInstance()
    const addressFactory = sipFactory.createAddressFactory()
    const headerFactory = sipFactory.createHeaderFactory()
    const messageFactory = sipFactory.createMessageFactory()
    const userAgent = new ArrayList()
    userAgent.add('Test I/O v1.0')

    const port = 5060
    const host = '192.168.1.2'
    const cseq = 0
    const viaHeaders = []
    const viaHeader = headerFactory.createViaHeader(host, port, 'udp', null)
    // Request RPort for Symmetric Response Routing in accordance with RFC 3581
    viaHeader.setRPort()
    viaHeaders.push(viaHeader)

    const maxForwardsHeader = headerFactory.createMaxForwardsHeader(70)
    const callIdHeader = headerFactory.createCallIdHeader('call0001')
    const cSeqHeader = headerFactory.createCSeqHeader(cseq, Request.REGISTER)
    const fromAddress = addressFactory.createAddress(`sip:${from}`)
    const fromHeader = headerFactory.createFromHeader(fromAddress, new SipUtils().generateTag())

    const toAddress = addressFactory.createAddress(`sip:${to}`)
    const toHeader = headerFactory.createToHeader(toAddress, null)
    const expireHeader = headerFactory.createExpiresHeader(3600)
    const contactAddress = addressFactory.createAddress(`sip:${from}:${port}`)
    const contactHeader = headerFactory.createContactHeader(contactAddress)

    if (withExpiresInContact) {
        // Added +1 to make sure is diferrent to expires header...
        contactHeader.setParameter('expires', '3601')
    }

    const userAgentHeader = headerFactory.createUserAgentHeader(userAgent)

    const request = messageFactory.createRequest('INVITE sip:sip.provider.net SIP/2.0\r\n\r\n')
    request.addHeader(viaHeader)
    request.addHeader(maxForwardsHeader)
    request.addHeader(callIdHeader)
    request.addHeader(cSeqHeader)
    request.addHeader(fromHeader)
    request.addHeader(toHeader)
    request.addHeader(contactHeader)
    request.addHeader(userAgentHeader)
    request.addHeader(headerFactory.createAllowHeader('INVITE'))
    request.addHeader(headerFactory.createAllowHeader('ACK'))
    request.addHeader(headerFactory.createAllowHeader('BYE'))
    request.addHeader(headerFactory.createAllowHeader('CANCEL'))
    request.addHeader(headerFactory.createAllowHeader('REGISTER'))
    request.addHeader(headerFactory.createAllowHeader('OPTIONS'))
    request.addHeader(expireHeader)

    return request
}

var SipListener         = Java.type('javax.sip.SipListener')
var Request             = Java.type('javax.sip.message.Request')
var ToHeader            = Java.type('javax.sip.header.ToHeader')
var ContactHeader       = Java.type('javax.sip.header.ContactHeader')
var ExpiresHeader       = Java.type('javax.sip.header.ExpiresHeader')
var ViaHeader           = Java.type('javax.sip.header.ViaHeader')
var CSeqHeader          = Java.type('javax.sip.header.CSeqHeader')
var ArrayList           = Java.type('java.util.ArrayList')
var SipUtils            = Java.type('gov.nist.javax.sip.Utils')
var LogManager          = Java.type('org.apache.logging.log4j.LogManager')

load('mod/utils/auth_helper.js')

function RegistryUtil(sipProvider, headerFactory, messageFactory, addressFactory, contactHeader, config) {
    let LOG = LogManager.getLogger()
    var cseq = 0

    this.requestChallenge = function(username, peerHost, expires = 300) {
        cseq++

        let viaHeaders        = new ArrayList()
        let viaHeader         = headerFactory.createViaHeader(config.ip, config.port, config.proto, null)
        viaHeaders.add(viaHeader)

        let maxForwardsHeader = headerFactory.createMaxForwardsHeader(70)
        let callIdHeader      = sipProvider.getNewCallId()
        let cSeqHeader        = headerFactory.createCSeqHeader(cseq, Request.REGISTER)
        let fromAddress       = addressFactory.createAddress("sip:" + username + '@' + peerHost)
        let fromHeader        = headerFactory.createFromHeader(fromAddress, new SipUtils().generateTag())
        let toHeader          = headerFactory.createToHeader(fromAddress, null)
        let expireHeader      = headerFactory.createExpiresHeader(expires)
        contactAddress        = addressFactory.createAddress("sip:" + username + "@" + config.ip + ":" + config.port)
        contactHeader         = headerFactory.createContactHeader(contactAddress)

        let request = messageFactory.createRequest("REGISTER sip:" + peerHost + " SIP/2.0\r\n\r\n")
        request.addHeader(callIdHeader)
        request.addHeader(cSeqHeader)
        request.addHeader(fromHeader)
        request.addHeader(toHeader)
        request.addHeader(maxForwardsHeader)
        request.addHeader(viaHeader)        // Warning: Should we add the array?
        request.addHeader(contactHeader)
        request.addHeader(expireHeader)

        try {
            let ct = sipProvider.getNewClientTransaction(request)
            ct.sendRequest()
        } catch(e) {
            if(e instanceof javax.sip.TransactionUnavailableException || e instanceof javax.sip.SipException) {
                LOG.warn("Unable to register with gw -> " + peerHost + ". (Verify your network status)")
            } else {
                LOG.warn(e)
            }
        }
    }
}
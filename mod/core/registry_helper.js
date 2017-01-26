var SipListener         = Java.type('javax.sip.SipListener')
var Request             = Java.type('javax.sip.message.Request')
var AuthorizationHeader = Java.type('javax.sip.header.AuthorizationHeader')
var AllowHeader         = Java.type('javax.sip.header.AllowHeader')
var RouteHeader         = Java.type('javax.sip.header.RouteHeader')
var ToHeader            = Java.type('javax.sip.header.ToHeader')
var ContactHeader       = Java.type('javax.sip.header.ContactHeader')
var ExpiresHeader       = Java.type('javax.sip.header.ExpiresHeader')
var ViaHeader           = Java.type('javax.sip.header.ViaHeader')
var CSeqHeader          = Java.type('javax.sip.header.CSeqHeader')
var WWWAuthenticateHeader = Java.type('javax.sip.header.WWWAuthenticateHeader')
var ArrayList           = Java.type('java.util.ArrayList')
var SipUtils            = Java.type('gov.nist.javax.sip.Utils')
var LogManager          = Java.type('org.apache.logging.log4j.LogManager')

load('mod/core/auth_helper.js')

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
        let cSeqHeader        = headerFactory.createCSeqHeader(cseq, "REGISTER")
        let fromAddress       = addressFactory.createAddress("sip:" + username + '@' + peerHost)
        let fromHeader        = headerFactory.createFromHeader(fromAddress, new SipUtils().generateTag())
        let toHeader          = headerFactory.createToHeader(fromAddress, null)
        let expireHeader      = headerFactory.createExpiresHeader(expires)
        contactAddress        = addressFactory.createAddress("sip:test" + "@" + config.ip + ":" + config.port)
        contactHeader         = headerFactory.createContactHeader(contactAddress)

        let request = messageFactory.createRequest("REGISTER sip:" + peerHost + " SIP/2.0\r\n\r\n")
        request.addHeader(callIdHeader)
        request.addHeader(cSeqHeader)
        request.addHeader(fromHeader)
        request.addHeader(toHeader)
        request.addHeader(maxForwardsHeader)
        request.addHeader(viaHeader)
        request.addHeader(contactHeader)
        request.addHeader(expireHeader)

        let ct = sipProvider.getNewClientTransaction(request)
        ct.sendRequest()
    }
}
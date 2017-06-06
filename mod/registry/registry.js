/**
 * @author Pedro Sanders
 * @since v1
 */
import getConfig from 'core/config_util'

const SipFactory = Packages.javax.sip.SipFactory
const SipUtils = Packages.gov.nist.javax.sip.Utils
const Request = Packages.javax.sip.message.Request
const InetAddress = Packages.java.net.InetAddress
const HashMap = Packages.java.util.HashMap
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()
var cseq = 0

export default class Registry {

    constructor(sipProvider, expires = 300, checkExpiresTime = 1) {
        this.expires = expires
        this.checkExpiresTime = checkExpiresTime
        this.sipProvider = sipProvider
        this.config = getConfig()
        this.messageFactory = SipFactory.getInstance().createMessageFactory()
        this.headerFactory = SipFactory.getInstance().createHeaderFactory()
        this.addressFactory = SipFactory.getInstance().createAddressFactory()
        this.userAgent = new java.util.ArrayList()
        this.userAgent.add('Sip I/O v1.0')
        this.registry = new HashMap()
    }

    requestChallenge(username, gwRef, peerHost, transport = 'udp') {
        let host = this.sipProvider.getListeningPoint(transport).getIPAddress()
        const port = this.sipProvider.getListeningPoint(transport).getPort()

        if (this.config.general.externalHost) {
            host = this.config.general.externalHost
        }

        cseq++

        const viaHeaders = []
        const viaHeader = this.headerFactory.createViaHeader(host, port, transport, null)
        // Request RPort for Symmetric Response Routing in accordance with RFC 3581
        viaHeader.setRPort()
        viaHeaders.push(viaHeader)

        const maxForwardsHeader = this.headerFactory.createMaxForwardsHeader(70)
        const callIdHeader = this.sipProvider.getNewCallId()
        const cSeqHeader = this.headerFactory.createCSeqHeader(cseq, Request.REGISTER)
        const fromAddress = this.addressFactory.createAddress('sip:' + username + '@' + peerHost)
        const fromHeader = this.headerFactory.createFromHeader(fromAddress, new SipUtils().generateTag())
        const toHeader = this.headerFactory.createToHeader(fromAddress, null)
        //const expireHeader = this.headerFactory.createExpiresHeader(this.expires)
        const contactAddress = this.addressFactory.createAddress('sip:' + username + '@' + host + ':' + port)
        const contactHeader = this.headerFactory.createContactHeader(contactAddress)
        const userAgentHeader = this.headerFactory.createUserAgentHeader(this.userAgent)
        const gwRefHeader = this.headerFactory.createHeader('GwRef', gwRef)

        const request = this.messageFactory.createRequest('REGISTER sip:' + peerHost + ' SIP/2.0\r\n\r\n')
        request.addHeader(viaHeader)
        request.addHeader(maxForwardsHeader)
        request.addHeader(callIdHeader)
        request.addHeader(cSeqHeader)
        request.addHeader(fromHeader)
        request.addHeader(toHeader)
        request.addHeader(contactHeader)
        request.addHeader(userAgentHeader)
        request.addHeader(gwRefHeader)
        request.addHeader(this.headerFactory.createAllowHeader('INVITE'))
        request.addHeader(this.headerFactory.createAllowHeader('ACK'))
        request.addHeader(this.headerFactory.createAllowHeader('BYE'))
        request.addHeader(this.headerFactory.createAllowHeader('CANCEL'))
        request.addHeader(this.headerFactory.createAllowHeader('REGISTER'))
        request.addHeader(this.headerFactory.createAllowHeader('OPTIONS'))
        //request.addHeader(expireHeader)

        try {
            const clientTransaction = this.sipProvider.getNewClientTransaction(request)
            clientTransaction.sendRequest()
        } catch(e) {
            if(e instanceof javax.sip.TransactionUnavailableException || e instanceof javax.sip.SipException) {
                LOG.warn('Unable to register with Gateway -> ' + peerHost + '. (Verify your network status)')
            } else {
                LOG.warn(e)
            }
        }

        LOG.debug(request)
    }

    storeRegistry(username, host, expires = 300) {

        const reg = {
            username: username,
            host: host,
            ip: InetAddress.getByName(host).getHostAddress(),
            expires: expires,
            registeredOn: Date.now()
        }

        this.registry.put(host, reg)
    }

    hasHost(host) {
        return this.registry.get(host) != null
    }

    hasIp(ip) {
        const iterator = this.registry.values().iterator()

        while(iterator.hasNext()) {
            const reg = iterator.next()
            if (reg.ip.equals(ip)) return true
         }
        return false
    }

    listAsJSON () {
        const s = []
        const iterator = this.registry.values().iterator()

        while(iterator.hasNext()) {
            const reg = iterator.next()
            s.push(reg)
        }

        return JSON.stringify(s)
    }

    start() {
        LOG.info('Starting Registry service')
        var registry = this.registry

        let unbindExpiredTask = new java.util.TimerTask({
            run: function() {
                const iterator = registry.values().iterator()
                while(iterator.hasNext()) {
                    let reg = iterator.next()
                    const elapsed = (Date.now() - reg.registeredOn) / 1000
                    if ((reg.expires - elapsed) <= 0) {
                        iterator.remove()
                    }
                }
            }
        })

        new java.util.Timer().schedule(unbindExpiredTask, 5000, this.checkExpiresTime * 60 * 1000)
    }

    stop() {
        // ??
    }
}

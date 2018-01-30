/**
 * @author Pedro Sanders
 * @since v1
 */
import getConfig from 'core/config_util'
import { Status } from 'resources/status'

const SipFactory = Packages.javax.sip.SipFactory
const SipUtils = Packages.gov.nist.javax.sip.Utils
const Request = Packages.javax.sip.message.Request
const InetAddress = Packages.java.net.InetAddress
const HashMap = Packages.java.util.HashMap
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()

var cseq = 0

export default class Registry {

    constructor(sipProvider, dataAPIs, expires = 300, checkExpiresTime = .5) {
        this.dataAPIs = dataAPIs.GatewaysAPI
        this.gatewaysAPI = dataAPIs.GatewaysAPI
        this.expires = expires
        this.checkExpiresTime = checkExpiresTime
        this.sipProvider = sipProvider
        this.config = getConfig()
        this.messageFactory = SipFactory.getInstance().createMessageFactory()
        this.headerFactory = SipFactory.getInstance().createHeaderFactory()
        this.addressFactory = SipFactory.getInstance().createAddressFactory()
        this.userAgent = new java.util.ArrayList()
        this.userAgent.add(this.config.metadata.userAgent)
        this.registry = new HashMap()
    }

    requestChallenge(username, gwRef, peerHost, transport, received, rport) {
        let host
        let port

        try {
            host = this.sipProvider.getListeningPoint(transport).getIPAddress()
            port = this.sipProvider.getListeningPoint(transport).getPort()
        } catch(e) {
            LOG.error("Transport '" + transport + "' not found in configs => .spec.transport.[*]")
            return
        }

        if (this.config.spec.externAddr) {
            host = this.config.spec.externAddr
        }

        if (received) host = received
        if (rport) port = rport

        cseq++

        const viaHeaders = []
        const viaHeader = this.headerFactory.createViaHeader(host, port, transport, null)
        // Request RPort to enable Symmetric Response in accordance with RFC 3581 and RFC 6314
        viaHeader.setRPort()
        viaHeaders.push(viaHeader)

        const maxForwardsHeader = this.headerFactory.createMaxForwardsHeader(70)
        const callIdHeader = this.sipProvider.getNewCallId()
        const cSeqHeader = this.headerFactory.createCSeqHeader(cseq, Request.REGISTER)
        const fromAddress = this.addressFactory.createAddress('sip:' + username + '@' + peerHost)
        const fromHeader = this.headerFactory.createFromHeader(fromAddress, new SipUtils().generateTag())
        const toHeader = this.headerFactory.createToHeader(fromAddress, null)
        const contactAddress = this.addressFactory.createAddress('sip:' + username + '@' + host + ':' + port)
        const contactHeader = this.headerFactory.createContactHeader(contactAddress)
        const userAgentHeader = this.headerFactory.createUserAgentHeader(this.userAgent)
        const gwRefHeader = this.headerFactory.createHeader('X-Gateway-Ref', gwRef)

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

        try {
            const clientTransaction = this.sipProvider.getNewClientTransaction(request)
            clientTransaction.sendRequest()
        } catch(e) {

            this.registry.remove(peerHost)

            if(e instanceof javax.sip.TransactionUnavailableException || e instanceof javax.sip.SipException) {
                LOG.warn('Unable to register with Gateway -> ' + peerHost + '. (Verify your network status)')
            } else {
                LOG.warn(e)
            }
        }

        LOG.debug(request)
    }

    storeRegistry(username, host, expires = 300) {
        // Re-register before actual time expiration
        let actualExpires = expires - 2 * 60 * this.checkExpiresTime

        const reg = {
            username: username,
            host: host,
            ip: InetAddress.getByName(host).getHostAddress(),
            expires: actualExpires,
            registeredOn: Date.now()
        }

        this.registry.put(host, reg)
    }

    removeRegistry (host) {
        this.registry.remove(host)
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
        var gatewaysAPI = this.gatewaysAPI
        var myRegistry = this

        function isExpired (host) {
            const reg = registry.get(host)

            if (reg == null) return true

            const elapsed = (Date.now() - reg.registeredOn) / 1000
            if ((reg.expires - elapsed) <= 0) {
                return true
            }
            return false
        }

        let registerTask = new java.util.TimerTask({
            run: function() {
                const result = gatewaysAPI.getGateways()
                if (result.status != Status.OK) return

                result.obj.forEach (function(gateway) {
                    let regService = gateway.spec.regService

                    if (isExpired(regService.host)) {
                        LOG.debug('Register with ' + gateway.metadata.name +  ' using '
                            + gateway.spec.regService.credentials.username + '@' + gateway.spec.regService.host)
                        myRegistry.requestChallenge(regService.credentials.username,
                            gateway.metadata.ref, regService.host, regService.transport)
                    }

                    let registries = gateway.spec.regService.registries

                    if (registries != undefined) {
                        registries.forEach (function(h) {
                            if (isExpired(regService.host)) {
                                LOG.debug('Register with ' + gateway.metadata.name +  ' using '  + gateway.spec.regService.credentials.username + '@' + h)
                                myRegistry.requestChallenge(gateway.spec.regService.credentials.username, gateway.metadata.ref, h, gateway.spec.regService.transport)
                            }
                        })
                    }
                })
           }
        })

        new java.util.Timer().schedule(registerTask, 10000, this.checkExpiresTime * 60 * 1000)
    }

    stop() {
        // ??
    }
}

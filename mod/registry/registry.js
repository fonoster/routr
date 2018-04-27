/**
 * @author Pedro Sanders
 * @since v1
 */
import getConfig from 'core/config_util'
import { Status } from 'core/status'
import moment from 'moment'

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

    getHostAddress(transport, received, rport) {
        try {
            const lp = this.sipProvider.getListeningPoint(transport)
            const host = this.config.spec.externAddr? this.config.spec.externAddr : lp.getIPAddress()
            const port = rport? rport : lp.getPort()
            return received? { host: received, port: port } : { host: host, port: port }
        } catch(e) {
            LOG.error("Transport '" + transport + "' not found in configs => .spec.transport.[*]")
            return
        }
    }

    requestChallenge(username, gwRef, peerHost, transport, received, rport) {
        const address = this.getHostAddress(transport, received, rport)
        const host = address.host
        const port = address.port
        const request = this.messageFactory.createRequest('REGISTER sip:' + peerHost + ' SIP/2.0\r\n\r\n')
        const fromAddress = this.addressFactory.createAddress('sip:' + username + '@' + peerHost)
        const contactAddress = this.addressFactory.createAddress('sip:' + username + '@' + host + ':' + port)
        const viaHeader = this.headerFactory.createViaHeader(host, port, transport, null)

        let headers = []

        viaHeader.setRPort()
        headers.push(viaHeader)
        headers.push(this.headerFactory.createMaxForwardsHeader(70))
        headers.push(this.sipProvider.getNewCallId())
        headers.push(this.headerFactory.createCSeqHeader(cseq++, Request.REGISTER))
        headers.push(this.headerFactory.createFromHeader(fromAddress, new SipUtils().generateTag()))
        headers.push(this.headerFactory.createToHeader(fromAddress, null))
        headers.push(this.headerFactory.createContactHeader(contactAddress))
        headers.push(this.headerFactory.createUserAgentHeader(this.userAgent))
        headers.push(this.headerFactory.createHeader('X-Gateway-Ref', gwRef))
        headers.push(this.headerFactory.createAllowHeader('INVITE'))
        headers.push(this.headerFactory.createAllowHeader('ACK'))
        headers.push(this.headerFactory.createAllowHeader('BYE'))
        headers.push(this.headerFactory.createAllowHeader('CANCEL'))
        headers.push(this.headerFactory.createAllowHeader('REGISTER'))
        headers.push(this.headerFactory.createAllowHeader('OPTIONS'))
        headers.forEach(header => request.addHeader(header))
        this.sendRequest(request, peerHost)
    }

    sendRequest(request, peerHost) {
        try {
            const clientTransaction = this.sipProvider.getNewClientTransaction(request)
            clientTransaction.sendRequest()
        } catch(e) {
            this.handleChallengeException(e, peerHost)
        }
        LOG.debug(request)
    }

    handleChallengeException(e, peerHost) {
        this.registry.remove(peerHost)
        if(e instanceof javax.sip.TransactionUnavailableException || e instanceof javax.sip.SipException) {
            LOG.warn('Unable to register with Gateway -> ' + peerHost + '. (Verify your network status)')
        } else {
            LOG.warn(e)
        }
    }

    storeRegistry(username, host, expires = 300) {
        // Re-register before actual time expiration
        let actualExpires = expires - 2 * 60 * this.checkExpiresTime

        const reg = {
            username: username,
            host: host,
            ip: InetAddress.getByName(host).getHostAddress(),
            expires: actualExpires,
            registeredOn: Date.now(),
            regOnFormatted: moment(new Date(Date.now())).fromNow()
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
            if (reg.ip.equals(ip)) {
                return true
            }
        }
        return false
    }

    listAsJSON() {
        const s = []
        const iterator = this.registry.values().iterator()

        while(iterator.hasNext()) {
            const reg = iterator.next()
            s.push(reg)
        }

        return s
    }

    isExpired (host) {
        const reg = this.registry.get(host)

        if (reg == null) {
          return true
        }

        const elapsed = (Date.now() - reg.registeredOn) / 1000
        return reg.expires - elapsed <= 0? true : false
    }

    start() {
        LOG.info('Starting Registry service')
        var gatewaysAPI = this.gatewaysAPI
        var myRegistry = this

        let registerTask = new java.util.TimerTask({
            run: function() {
                const response = gatewaysAPI.getGateways()

                if (response.status == Status.OK) {
                    response.result.forEach (function(gateway) {
                        if (myRegistry.isExpired(gateway.spec.host)) {
                            LOG.debug('Register with ' + gateway.metadata.name +  ' using '
                                + gateway.spec.credentials.username + '@' + gateway.spec.host)
                            myRegistry.requestChallenge(gateway.spec.credentials.username,
                                gateway.metadata.ref, gateway.spec.host, gateway.spec.transport)
                        }

                        let registries = gateway.spec.registries

                        if (registries != undefined) {
                            registries.forEach (function(h) {
                                if (myRegistry.isExpired(gateway.spec.host)) {
                                    LOG.debug('Register with ' + gateway.metadata.name +  ' using '  + gateway.spec.credentials.username + '@' + h)
                                    myRegistry.requestChallenge(gateway.spec.credentials.username, gateway.metadata.ref, h, gateway.spec.transport)
                                }
                            })
                        }
                    })
                }
           }
        })

        new java.util.Timer().schedule(registerTask, 10000, this.checkExpiresTime * 60 * 1000)
    }

    stop() {
        // ??
    }
}

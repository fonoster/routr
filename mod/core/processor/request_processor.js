/**
 * @author Pedro Sanders
 * @since v1
 */
import RegisterHandler from 'core/processor/register_handler'
import CancelHandler from 'core/processor/cancel_handler'
import RouteInfo from 'core/processor/route_info'
import Context from 'core/context'
import AclUtil from 'core/acl/acl_util'
import getConfig from 'core/config_util'
import { Status } from 'location/status'
import { RoutingType } from 'core/routing_type'
import isEmpty from 'utils/obj_util'
import IPUtil from 'core/ip_util'

const SipFactory = Packages.javax.sip.SipFactory
const RouteHeader = Packages.javax.sip.header.RouteHeader
const ToHeader = Packages.javax.sip.header.ToHeader
const FromHeader = Packages.javax.sip.header.FromHeader
const ContactHeader = Packages.javax.sip.header.ContactHeader
const ViaHeader = Packages.javax.sip.header.ViaHeader
const MaxForwardsHeader = Packages.javax.sip.header.MaxForwardsHeader
const ProxyAuthorizationHeader = Packages.javax.sip.header.ProxyAuthorizationHeader
const Request = Packages.javax.sip.message.Request
const Response = Packages.javax.sip.message.Response
const HashMap = Packages.java.util.HashMap
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()

export default class RequestProcessor {

    constructor(sipProvider, locator, registry, registrar, dataAPIs, contextStorage) {
        this.sipProvider = sipProvider
        this.sipStack = this.sipProvider.getSipStack()
        this.contextStorage = contextStorage
        this.locator = locator
        this.registry = registry
        this.dataAPIs = dataAPIs
        this.domainsAPI = dataAPIs.DomainsAPI
        this.peersAPI = dataAPIs.PeersAPI
        this.agentsAPI = dataAPIs.AgentsAPI
        this.didsAPI = dataAPIs.DIDsAPI
        this.messageFactory = SipFactory.getInstance().createMessageFactory()
        this.headerFactory = SipFactory.getInstance().createHeaderFactory()
        this.addressFactory = SipFactory.getInstance().createAddressFactory()
        this.dsam = new Packages.gov.nist.javax.sip.clientauthutils.DigestServerAuthenticationHelper()
        this.config = getConfig()
        this.generalAcl = this.config.spec.accessControlList
        this.registerHandler = new RegisterHandler(locator, registrar)
        this.cancelHandler = new CancelHandler(sipProvider, contextStorage)
        this.ipUtil = new IPUtil()
    }

    process(event) {
        const requestIn = event.getRequest()
        const method = requestIn.getMethod()
        let serverTransaction = event.getServerTransaction()

        // ACK does not need a transaction
        if (serverTransaction == null && !method.equals(Request.ACK)) {
            serverTransaction = this.sipProvider.getNewServerTransaction(requestIn)
        }

        const requestOut = requestIn.clone()

        if (method.equals(Request.REGISTER)) {
            // Should we apply ACL rules here too?
            this.registerHandler.register(requestIn, serverTransaction)
            return
        } else if(method.equals(Request.CANCEL)) {
            this.cancelHandler.cancel(requestIn, serverTransaction)
            return
        } else {
            const fromHeader = requestIn.getHeader(FromHeader.NAME)
            const fromURI = fromHeader.getAddress().getURI()
            const remoteIp = event.getRemoteIpAddress()
            const routeInfo = new RouteInfo(requestIn, this.dataAPIs)

            LOG.debug('routing type -> ' + routeInfo.getRoutingType())

            // 1. Security check
            // This routing type is not yet supported
            if (routeInfo.getRoutingType().equals(RoutingType.INTER_DOMAIN_ROUTING)) {
                serverTransaction.sendResponse(this.messageFactory.createResponse(Response.FORBIDDEN, requestIn))
                LOG.debug(requestIn)
                return
            }

            // Other routing types are assume to be already login(registered)
            /*if (!routeInfo.getRoutingType().equals(RoutingType.DOMAIN_INGRESS_ROUTING)) {
                // Do not need to authorized ACK or BYE messages...
                if (!method.equals(Request.ACK)
                    && !method.equals(Request.BYE)
                    && this.authorized(requestIn, serverTransaction) == 'UNAUTHORIZED') {
                    serverTransaction.sendResponse(this.messageFactory.createResponse(Response.UNAUTHORIZED, requestIn))
                    LOG.debug(requestIn)
                    return
                } else if (!method.equals(Request.ACK) && !method.equals(Request.BYE)
                    && this.authorized(requestIn, serverTransaction) == 'SENT_CHALLENGE') {
                    LOG.debug(requestIn)
                    return
                }
            } else {
                if (!this.registry.hasIp(remoteIp)) {
                    serverTransaction.sendResponse(this.messageFactory.createResponse(Response.UNAUTHORIZED, requestIn))
                    LOG.debug(requestIn)
                    return
                }
            }*/

            let addressOfRecord = this.getAOR(requestIn)

            // We only apply ACL rules to Domain Routing.
            if (routeInfo.getRoutingType().equals(RoutingType.INTRA_DOMAIN_ROUTING)) {
                const result = this.domainsAPI.getDomain(addressOfRecord.getHost())
                if (result.status == Status.OK) {
                    const domainObj = result.obj
                    if(!new AclUtil(this.generalAcl).isIpAllowed(domainObj, remoteIp)) {
                        serverTransaction.sendResponse(this.messageFactory.createResponse(Response.UNAUTHORIZED, requestIn))
                        LOG.debug(requestIn)
                        return
                    }
                }
            }

            // 2. Decrement the max forwards value
            const maxForwardsHeader = requestOut.getHeader(MaxForwardsHeader.NAME)
            maxForwardsHeader.decrementMaxForwards()

            // 3. Determine route
            // 3.0 Peer Egress Routing (PR)
            if (routeInfo.getRoutingType().equals(RoutingType.PEER_EGRESS_ROUTING)) {
                let telUrl

                // First look for the header 'DIDRef'
                if (requestOut.getHeader('DIDRef')) {
                    telUrl = this.addressFactory.createTelURL(requestOut.getHeader('DIDRef'))
                } else {
                    telUrl = this.addressFactory.createTelURL(fromURI.getUser())
                }

                let result = this.didsAPI.getDIDByTelUrl(telUrl)

                if (result.status == Status.NOT_FOUND) {
                    serverTransaction.sendResponse(this.messageFactory.createResponse(Response.TEMPORARILY_UNAVAILABLE, requestIn))
                    LOG.debug(requestIn)
                    return
                }

                const didRef = result.obj.metadata.ref
                result = this.locator.getEgressRouteForPeer(addressOfRecord, didRef)

                if (result.status == Status.NOT_FOUND) {
                    serverTransaction.sendResponse(this.messageFactory.createResponse(Response.TEMPORARILY_UNAVAILABLE, requestIn))
                    LOG.debug(requestIn)
                    return
                }

                this.processRoute(requestIn, requestOut, result.obj, serverTransaction, routeInfo)

                LOG.debug(requestOut)
                return
            }

            // 3.1 Intra-Domain Routing(IDR), Domain Ingress Routing (DIR), & Domain Egress Routing (DER)
            const result = this.locator.findEndpoint(addressOfRecord)

            if (result.status == Status.NOT_FOUND) {
                serverTransaction.sendResponse(this.messageFactory.createResponse(Response.TEMPORARILY_UNAVAILABLE, requestIn))
                LOG.debug(requestIn)
                return
            }

            // 4. Send response
            const location = result.obj

            if (location instanceof HashMap) {
                let caIterator

                try {
                    caIterator = location.values().iterator()
                } catch(e) {}

                if (!caIterator.hasNext()) {
                    serverTransaction.sendResponse(this.messageFactory.createResponse(Response.TEMPORARILY_UNAVAILABLE, requestIn))
                    LOG.debug(requestIn)
                    return
                }

                // Fork the call if needed
                while(caIterator.hasNext()) {
                    const route = caIterator.next()
                    this.processRoute(requestIn, requestOut, route, serverTransaction, routeInfo)
                }
            } else {
                const route = location
                this.processRoute(requestIn, requestOut, route, serverTransaction, routeInfo)
            }

            return
        }
        LOG.debug(requestIn)
    }

    processRoute(requestIn, requestOut, route, serverTransaction, routeInfo) {
        const routeHeader = requestIn.getHeader(RouteHeader.NAME)
        const rVia = requestIn.getHeader(ViaHeader.NAME)
        const transport = rVia.getTransport().toLowerCase()
        const lp = this.sipProvider.getListeningPoint(transport)
        const localPort = lp.getPort()
        const localIp = lp.getIPAddress().toString()
        const method = requestIn.getMethod()

        LOG.debug('flow -> ' + JSON.stringify(route))

        let advertisedAddr
        let advertisedPort

        // Keep and eye here o.O
        //if (method.equals(Request.INVITE))
        requestOut.setRequestURI(route.contactURI)

        // No egress routing has sentByAddress. They are assume to be entities outside the local network.
        if (this.config.spec.externAddr && (route.sentByAddress == undefined
            || route.sentByAddress.endsWith(".invalid")
            || !this.ipUtil.isLocalnet(route.sentByAddress))) {
            advertisedAddr = this.config.spec.externAddr.contains(":") ? this.config.spec.externAddr.split(":")[0] : this.config.spec.externAddr
            advertisedPort = this.config.spec.externAddr.contains(":") ? this.config.spec.externAddr.split(":")[1] : localPort
        }  else {
            advertisedAddr = localIp
            advertisedPort = localPort
        }

        LOG.debug('advertisedAddr is -> ' + advertisedAddr)
        LOG.debug('advertisedPort is -> ' + advertisedPort)

        print ('DBG001')

        // Remove route header if host's address is the same as the proxy's address
        if (routeHeader) {
            const h = routeHeader.getAddress().getURI().getHost()
            const routeHost = this.ipUtil.isIp(h)? h : Packages.java.net.InetAddress.getByName(h).getHostAddress()
            const routePort = routeHeader.getAddress().getURI().getPort()
            if ((routeHost.equals(localIp) && routePort.equals(localPort))
                || ((routeHost.equals(advertisedAddr) && routePort.equals(advertisedPort)))) {
                requestOut.removeFirst(RouteHeader.NAME)
            }
        }

        print ('DBG002')

        // Stay in the signaling path
        if (this.config.spec.recordRoute) {
            const proxyURI = this.addressFactory.createSipURI(null, advertisedAddr)
            proxyURI.setLrParam()
            proxyURI.setPort(advertisedPort)
            const proxyAddress = this.addressFactory.createAddress(proxyURI)
            const recordRouteHeader = this.headerFactory.createRecordRouteHeader(proxyAddress)
            requestOut.addHeader(recordRouteHeader)
        }

        print ('DBG003')

        // Request RPort to enable Symmetric Response in accordance with RFC 3581 and RFC 6314
        const viaHeader = this.headerFactory.createViaHeader(advertisedAddr, advertisedPort, transport, null)
        viaHeader.setRPort()
        requestOut.addFirst(viaHeader)

        if (route.thruGw) {
            const contactHeader = requestIn.getHeader(ContactHeader.NAME)
            const contactURI = contactHeader.getAddress().getURI()
            const fromHeader = requestIn.getHeader(FromHeader.NAME)
            const toHeader = requestIn.getHeader(ToHeader.NAME)
            const gwRefHeader = this.headerFactory.createHeader('X-Gateway-Ref', route.gwRef)
            const remotePartyIdHeader = this.headerFactory
                .createHeader('Remote-Party-ID', '<sip:'+ route.did + '@' + route.gwHost+ '>;screen=yes;party=calling')

            const from = 'sip:' + route.gwUsername + '@' + route.gwHost
            const to = 'sip:' + toHeader.getAddress().toString().match('sips?:(.*)@(.*)')[1] + '@' + route.gwHost

            contactURI.setUser(route.gwUsername)
            contactHeader.setAddress(this.addressFactory.createAddress(contactURI.toString()))

            // This might not work with all provider
            const fromAddress = this.addressFactory.createAddress(from)
            const toAddress = this.addressFactory.createAddress(to)
            fromHeader.setAddress(fromAddress)
            toHeader.setAddress(toAddress)
            requestOut.setHeader(fromHeader)
            requestOut.setHeader(toHeader)

            requestOut.setHeader(contactHeader)
            requestOut.setHeader(gwRefHeader)
            requestOut.setHeader(remotePartyIdHeader)
        }

        print ('DBG004')

        requestOut.removeHeader("Proxy-Authorization")

        // Does not need a transaction
        if(method.equals(Request.ACK)) {
             print ('DBG005')

            this.sipProvider.sendRequest(requestOut)
             print ('DBG006')

        } else {
            try {
                // The request must be cloned or the stack will not fork the call
                const clientTransaction = this.sipProvider.getNewClientTransaction(requestOut.clone())
                clientTransaction.sendRequest()

                // Transaction context
                const context = new Context()
                context.clientTransaction = clientTransaction
                context.serverTransaction = serverTransaction
                context.method = method
                context.requestIn = requestIn
                context.requestOut = requestOut
                this.contextStorage.saveContext(context)
            } catch (e) {
                if (e instanceof java.net.ConnectException) {
                    LOG.error('Connection refused. Please see: https://docs.oracle.com/javase/7/docs/api/java/net/ConnectException.html')
                } else if (e instanceof java.net.NoRouteToHostException) {
                    LOG.error('No route to host. Please see: https://docs.oracle.com/javase/7/docs/api/java/net/NoRouteToHostException.html')
                } else {
                    LOG.error(e.getMessage())
                }
            }
        }

        LOG.debug(requestOut)
    }

    authorized(request, serverTransaction) {
        const authHeader = request.getHeader(ProxyAuthorizationHeader.NAME)
        const fromHeader = request.getHeader(FromHeader.NAME)
        const fromURI = fromHeader.getAddress().getURI()

        // WARNING: Should limit the amount of attempts...
        if (authHeader == null) {
            const challengeResponse = this.messageFactory.createResponse(Response.PROXY_AUTHENTICATION_REQUIRED, request)
            this.dsam.generateChallenge(this.headerFactory, challengeResponse, fromURI.getHost())
            serverTransaction.sendResponse(challengeResponse)
            LOG.debug(request)
            return 'SENT_CHALLENGE'
        }

        // WARNING: If they are multiple peers with the same name this might be an issue
        let result = this.peersAPI.getPeer(authHeader.getUsername())

        let user

        if (result.status == Status.OK) {
            user = result.obj
        } else {
            // This is also a security check. The user in the authentication must exist for the 'fromURI.getHost()' domain
            result = this.agentsAPI.getAgent(fromURI.getHost(), authHeader.getUsername())
            if (result.status == Status.OK ) {
                user = result.obj
            }
        }

        if (!user || !this.dsam.doAuthenticatePlainTextPassword(request, user.spec.credentials.secret)) {
            return 'UNAUTHORIZED'
        }

        return 'AUTHORIZED'
    }

    /**
     * Discover DIDs sent via a non-standard header
     * The header must be added at config.spec.addressInfo[*]
     * If the such header is present then overwrite the AOR
     */
    getAOR (request) {
        for (let x in this.config.spec.addressInfo) {
            let info = this.config.spec.addressInfo[x]
            if (!!request.getHeader(info)) {
                let v = request.getHeader(info).getValue()
                if (/sips?:.*@.*/.test(v) || /tel:\d+/.test(v)) {
                    return this.addressFactory.createURI(v)
                }
                LOG.error('Invalid address: ' + v)
            }
        }
        return request.getHeader(ToHeader.NAME).getAddress().getURI()
    }
}

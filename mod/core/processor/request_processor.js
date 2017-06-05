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

    constructor(sipProvider, locator, registrar, dataAPIs, contextStorage) {
        this.sipProvider = sipProvider
        this.locator = locator
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
        this.generalAcl = this.config.general.accessControlList
        this.registerHandler = new RegisterHandler(locator, registrar)
        this.cancelHandler = new CancelHandler(sipProvider, contextStorage)
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
            this.registerHandler.register(requestIn, serverTransaction)
            return
        } else if(method.equals(Request.CANCEL)) {
            this.cancelHandler.cancel(requestIn, serverTransaction)
            return
        } else {
            const routeHeader = requestIn.getHeader(RouteHeader.NAME)
            const rVia = requestIn.getHeader(ViaHeader.NAME)
            const transport = rVia.getTransport().toLowerCase()
            const contactHeader = requestIn.getHeader(ContactHeader.NAME)
            const contactURI = contactHeader.getAddress().getURI()
            const lp = this.sipProvider.getListeningPoint(transport)
            const host = lp.getIPAddress().toString()
            const port = lp.getPort()
            const fromHeader = requestIn.getHeader(FromHeader.NAME)
            const fromURI = fromHeader.getAddress().getURI()
            const remoteIp = event.getRemoteIpAddress()
            const remotePort = event.getRemotePort()
            const routeInfo = new RouteInfo(requestIn, this.dataAPIs)

            let user

            LOG.debug('routing type -> ' + routeInfo.getRoutingType())

            // 1. Security check
            // This routing type is not yet supported
            if (routeInfo.getRoutingType().equals(RoutingType.INTER_DOMAIN_ROUTING)) {
                serverTransaction.sendResponse(this.messageFactory.createResponse(Response.FORBIDDEN, requestIn))
                LOG.debug(requestIn)
            }

            if (!routeInfo.getRoutingType().equals(RoutingType.DOMAIN_INGRESS_ROUTING)) {
                user = this.authenticate(requestIn, serverTransaction)
                if (user == null) {
                    serverTransaction.sendResponse(this.messageFactory.createResponse(Response.UNAUTHORIZED, requestIn))
                    LOG.debug(requestIn)
                }
            }

            let addressOfRecord = this.getAOR(requestIn)

            // We only apply ACL rules to Domain Routing. Communication with Gateways must be secured
            // Using ipsec, ssl, or other mechanism.

            if (routeInfo.getRoutingType().equals(RoutingType.INTRA_INGRESS_ROUTING) ||
                routeInfo.getRoutingType().equals(RoutingType.INTER_INGRESS_ROUTING)) {
                const result = this.domainsAPI.getDomain(addressOfRecord.getHost())

                if (result.status == Status.OK) {
                    const domainObj = result.obj
                    if(!new AclUtil(this.generalAcl).isIpAllowed(domainObj, remoteIp)) {
                        serverTransaction.sendResponse(this.messageFactory.createResponse(Response.UNAUTHORIZED, requestIn))
                        LOG.debug('<-------\n' + requestIn)
                        return
                    }
                }
            }

            // 2. Configure
            // 2.0 Decrement the max forwards value
            const maxForwardsHeader = requestOut.getHeader(MaxForwardsHeader.NAME)
            maxForwardsHeader.decrementMaxForwards()

            // 2.1 Remove Route-Header
            if (routeHeader) {
                const nextHop = routeHeader.getAddress().getURI().getHost()
                if (nextHop.equals(host) || nextHop.equals(this.config.general.externalHost)) {
                    requestOut.removeFirst(RouteHeader.NAME)
                }
            }

            // 2.2 Stay in the signaling path of the dialog
            if (this.config.general.recordRoute) {
                const proxyURI = this.addressFactory.createSipURI(null, host)
                proxyURI.setLrParam()
                const proxyAddress = this.addressFactory.createAddress(proxyURI)
                const recordRouteHeader = this.headerFactory.createRecordRouteHeader(proxyAddress)
                requestOut.addHeader(recordRouteHeader)
            }

            // 2.3 Request RPort for Symmetric Response Routing in accordance with RFC 3581
            const viaHeader = this.headerFactory.createViaHeader(host, port, transport, null)
            viaHeader.setRPort()
            requestOut.addFirst(viaHeader)

            // 3. Determine route
            // 3.0 Peer Egress Routing (PR)
            if (routeInfo.getRoutingType().equals(RoutingType.PEER_EGRESS_ROUTING)) {
                const telUrl = this.addressFactory.createTelURL(fromURI.getUser())
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

                this.processRoute(requestIn, requestOut, result.obj)

                LOG.debug(requestOut)
                return
            }

            // 3.1 In-Domain Routing(IDR), Domain Ingress Routing (DIR), & Domain Egress Routing (DER)
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
                    this.processRoute(requestIn, requestOut, route)
                }
            } else {
                const route = location
                this.processRoute(requestIn, requestOut, route)
            }

            return
        }
        LOG.debug(requestIn)
    }

    processRoute(requestIn, requestOut, route) {
        const method = requestIn.getMethod()
        requestOut.setRequestURI(route.contactURI)

        if (route.thruGw) {
            const fromHeader = requestIn.getHeader(FromHeader.NAME)
            const toHeader = requestIn.getHeader(ToHeader.NAME)
            const gwRefHeader = this.headerFactory.createHeader('GwRef', route.gwRef)

            //const from = 'sip:' + route.did + '@' + route.gwHost  // This does not work with all providers
            const from = 'sip:' + route.gwUsername + '@' + route.gwHost
            const to = 'sip:' + toHeader.getAddress().toString().match('sips?:(.*)@(.*)')[1] + '@' + route.gwHost

            // This might not work with all provider
            const fromAddress = this.addressFactory.createAddress(from)
            fromAddress.setDisplayName(route.did)
            const toAddress = this.addressFactory.createAddress(to)

            fromHeader.setAddress(fromAddress)
            toHeader.setAddress(toAddress)

            requestOut.setHeader(gwRefHeader)
            requestOut.setHeader(fromHeader)
            requestOut.setHeader(toHeader)
        }

        // Does not need a transaction
        if(method.equals(Request.ACK)) {
            this.sipProvider.sendRequest(requestOut)
        } else {
            try {
                const clientTransaction = this.sipProvider.getNewClientTransaction(requestOut)
                clientTransaction.sendRequest()

                // Transaction context
                const context = new Context()
                context.clientTransaction = clientTransaction
                context.serverTransaction = serverTransaction
                context.method = method
                context.requestIn = requestIn
                context.requestOut = requestOut
                contextStorage.saveContext(context)
            } catch (e) {
                if (e instanceof java.net.ConnectException) {
                    LOG.error('Connection refused. Please see: https://docs.oracle.com/javase/7/docs/api/java/net/ConnectException.html')
                } else if (e instanceof java.net.NoRouteToHostException) {
                    LOG.error('No route to host. Please see: https://docs.oracle.com/javase/7/docs/api/java/net/NoRouteToHostException.html')
                } else {
                    LOG.error(e.getStackTrace())
                }
            }
        }

        LOG.debug(requestOut)
    }

    authenticate(request, serverTransaction) {
        const authHeader = request.getHeader(ProxyAuthorizationHeader.NAME)
        const fromHeader = request.getHeader(FromHeader.NAME)
        const fromURI = fromHeader.getAddress().getURI()
        if (authHeader == null) {
            const challengeResponse = this.messageFactory.createResponse(Response.PROXY_AUTHENTICATION_REQUIRED, request)
            this.dsam.generateChallenge(this.headerFactory, challengeResponse, "sipio")
            serverTransaction.sendResponse(challengeResponse)
            LOG.debug(request)
            return
        }

        let result = this.peersAPI.getPeer(authHeader.getUsername())

        let user

        if (result.status == Status.OK) {
            user = result.obj
        } else {
            // This is also a security check. The user in the authentication must exit for the "formURI.getHost()" domain
            result = this.agentsAPI.getAgent(fromURI.getHost(), authHeader.getUsername())

            if (result.status == Status.OK ) {
                user = result.obj
            }
        }

        if (!this.dsam.doAuthenticatePlainTextPassword(request, user.spec.credentials.secret)) {
            const challengeResponse = this.messageFactory.createResponse(Response.PROXY_AUTHENTICATION_REQUIRED, request)
            this.dsam.generateChallenge(this.headerFactory, challengeResponse, "sipio")
            serverTransaction.sendResponse(challengeResponse)
            LOG.debug(request)
            return
        }

        return user
    }

    /**
     * Discover DIDs sent via a non-standard header
     * The header must be added at config.general.addressInfo[*]
     * If the such header is present then overwrite the AOR
     */
    getAOR (request) {
        const toHeader = request.getHeader(ToHeader.NAME)

        if(!!this.config.general.addressInfo) {
            this.config.general.addressInfo.forEach(function(info) {
                if (!!request.getHeader(info)) {
                    return addressOfRecord = this.addressFactory.createTelURL(request.getHeader(info).getValue())
                }
            })
        }

        return toHeader.getAddress().getURI()
    }
}

/**
 * @author Pedro Sanders
 * @since v1
 */
import ProcessorUtils from 'core/processor/utils'
import IPUtil from 'core/ip_util'
import Context from 'core/context'
import getConfig from 'core/config_util'
import { Status } from 'core/status'

const SipFactory = Packages.javax.sip.SipFactory
const Request = Packages.javax.sip.message.Request
const Response = Packages.javax.sip.message.Response
const RouteHeader = Packages.javax.sip.header.RouteHeader
const ToHeader = Packages.javax.sip.header.ToHeader
const FromHeader = Packages.javax.sip.header.FromHeader
const ContactHeader = Packages.javax.sip.header.ContactHeader
const ViaHeader = Packages.javax.sip.header.ViaHeader
const MaxForwardsHeader = Packages.javax.sip.header.MaxForwardsHeader
const ProxyAuthorizationHeader = Packages.javax.sip.header.ProxyAuthorizationHeader
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()

export default class RequestHandler {

    constructor(locator, sipProvider, dataAPIs, contextStorage) {
        this.sipProvider = sipProvider
        this.locator = locator
        this.contextStorage = contextStorage
        this.dataAPIs = dataAPIs
        this.messageFactory = SipFactory.getInstance().createMessageFactory()
        this.headerFactory = SipFactory.getInstance().createHeaderFactory()
        this.addressFactory = SipFactory.getInstance().createAddressFactory()
        this.config = getConfig()
        this.ipUtil = new IPUtil(getConfig())
    }

    doProcess(request, serverTransaction) {
        const responseUtil = new ResponseUtil(request, serverTransaction, this.messageFactory)
        let response = this.locator.findEndpoint(ProcessorUtils.getAOR(request))

        if (response.status == Status.NOT_FOUND) {
            return responseUtil.sendResponse(Response.TEMPORARILY_UNAVAILABLE)
        }

        if (RequestHandler.isAuthorized(request) == false) {
            return responseUtil.sendResponse(Response.FORBIDDEN)
        }

        const routes = response.result

        if(routes.length == 0) {
            return responseUtil.sendResponse(Response.TEMPORARILY_UNAVAILABLE)
        }

        // Call forking
        for (const x in routes) {
            this.processRoute(request, serverTransaction, routes[x])
        }
    }

    processRoute(requestIn, serverTransaction, route) {
        const transport = requestIn.getHeader(ViaHeader.NAME).getTransport().toLowerCase()
        const lp = this.sipProvider.getListeningPoint(transport)
        const localAddr = { host: lp.getIPAddress().toString(), port: lp.getPort() }
        const advertisedAddr = this.getAdvertizedAddr(route, localAddr, this.config.spec.externAddr)

        LOG.debug('advertised addr: ' + JSON.stringify(advertisedAddr))
        LOG.debug('flow: ' + JSON.stringify(route))

        let requestOut = this.configureGeneral(requestIn, route, advertisedAddr)

        if(this.proxyOwnsRequest(requestOut, localAddr, advertisedAddr)) {
            requestOut.removeFirst(RouteHeader.NAME)
        }

        if(this.stayInSignalingPath()) {
            requestOut = this.configureRecordRoute(requestOut)
        }

        if(route.thruGw) {
            requestOut = this.configureRoutingHeaders(requestOut, route)
        }

        this.sendRequest(requestIn, requestOut, serverTransaction)
    }

    stayInSignalingPath() {
        return this.config.spec.recordRoute? true : false
    }

    proxyOwnsRequest(request, localAddr, advertisedAddr) {
        const routeHeader = request.getHeader(RouteHeader.NAME)
        if (routeHeader) {
            const h = routeHeader.getAddress().getURI().getHost()
            const host = IPUtil.isIp(h)? h : Packages.java.net.InetAddress.getByName(h).getHostAddress()
            const port = routeHeader.getAddress().getURI().getPort() == -1? 5060 : routeHeader.getAddress().getURI().getPort()

            if (host.equals(advertisedAddr.host) && port.equals(advertisedAddr.port)) {
                return true
            }

            if (host.equals(localAddr.host) && port.equals(localAddr.port)) {
                return true
            }
        }
        return false
    }

    configureGeneral(requestIn, route, advertisedAddr) {
        const transport = requestIn.getHeader(ViaHeader.NAME).getTransport().toLowerCase()
        let requestOut = requestIn.clone()
        requestOut.setRequestURI(route.contactURI)
        const viaHeader = this.headerFactory
          .createViaHeader(advertisedAddr.host, advertisedAddr.port, transport, null)
        viaHeader.setRPort()
        requestOut.addFirst(viaHeader)
        requestOut.removeHeader("Proxy-Authorization")
        const maxForwardsHeader = requestOut.getHeader(MaxForwardsHeader.NAME)
        maxForwardsHeader.decrementMaxForwards()
        return requestOut
    }

    configureRecordRoute(requestIn, advertisedAddr) {
        const requestOut = requestIn.clone()
        const proxyURI = this.addressFactory.createSipURI(null, advertisedAddr.host)
        proxyURI.setLrParam()
        proxyURI.setPort(advertisedAddr.port)
        const proxyAddress = this.addressFactory.createAddress(proxyURI)
        const recordRouteHeader = this.headerFactory.createRecordRouteHeader(proxyAddress)
        requestOut.addHeader(recordRouteHeader)
        return requestOut
    }

    configureRoutingHeaders(requestIn, route) {
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

        const requestOut = requestIn.clone()
        requestOut.setHeader(fromHeader)
        requestOut.setHeader(toHeader)
        requestOut.setHeader(contactHeader)
        requestOut.setHeader(gwRefHeader)
        requestOut.setHeader(remotePartyIdHeader)

        return requestOut
    }

    sendRequest(requestIn, requestOut, serverTransaction) {
        // Does not need a transaction
        if(requestIn.getMethod().equals(Request.ACK)) {
            return this.sipProvider.sendRequest(requestOut)
        }

        try {
            // The request must be cloned or the stack will not fork the call
            const clientTransaction = this.sipProvider.getNewClientTransaction(requestOut.clone())
            clientTransaction.sendRequest()
            this.saveContext(requestIn, requestOut, clientTransaction, serverTransaction)
        } catch (e) {
            if (e instanceof java.net.ConnectException) {
                LOG.error('Connection refused. Please see: https://docs.oracle.com/javase/7/docs/api/java/net/ConnectException.html')
            } else if (e instanceof java.net.NoRouteToHostException) {
                LOG.error('No route to host. Please see: https://docs.oracle.com/javase/7/docs/api/java/net/NoRouteToHostException.html')
            } else {
                LOG.error(e)
            }
        }
        LOG.debug(requestOut)
    }

    saveContext(requestIn, requestOut, clientTransaction, serverTransaction) {
        // Transaction context
        const context = new Context()
        context.clientTransaction = clientTransaction
        context.serverTransaction = serverTransaction
        context.method = requestIn.getMethod()
        context.requestIn = requestIn
        context.requestOut = requestOut
        this.contextStorage.saveContext(context)
    }

    getAdvertizedAddr(route, localAddr, externAddr) {
        // No egress routing has sentByAddress. They are assume to be entities outside the local network.
        if (externAddr && (route.sentByAddress == undefined
            || route.sentByAddress.endsWith(".invalid")
            || !this.ipUtil.isLocalnet(route.sentByAddress))) {

            return {
                host: externAddr.contains(":") ? externAddr.split(":")[0] : externAddr,
                port: externAddr.contains(":") ? externAddr.split(":")[1] : localPort
            }
        }

        return {
            host: localAddr.host,
            port: localAddr.port
        }
    }

    static isAuthorized(request) {
        return true
    }
}

class ResponseUtil {

    constructor(request, serverTransaction, messageFactory) {
        this.request = request
        this.st = serverTransaction
        this.messageFactory = messageFactory
    }

    sendResponse(responseType) {
        this.st.sendResponse(this.messageFactory.createResponse(responseType, this.request))
    }
}

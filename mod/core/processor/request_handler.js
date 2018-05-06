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
const CSeqHeader = Packages.javax.sip.header.CSeqHeader
const ToHeader = Packages.javax.sip.header.ToHeader
const FromHeader = Packages.javax.sip.header.FromHeader
const ContactHeader = Packages.javax.sip.header.ContactHeader
const ViaHeader = Packages.javax.sip.header.ViaHeader
const MaxForwardsHeader = Packages.javax.sip.header.MaxForwardsHeader
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()

export default class RequestHandler {

    constructor(locator, sipProvider, dataAPIs, contextStorage) {
        this.sipProvider = sipProvider
        this.locator = locator
        this.contextStorage = contextStorage
        this.messageFactory = SipFactory.getInstance().createMessageFactory()
        this.headerFactory = SipFactory.getInstance().createHeaderFactory()
        this.addressFactory = SipFactory.getInstance().createAddressFactory()
        this.config = getConfig()
        this.ipUtil = new IPUtil(getConfig())
    }

    doProcess(request, serverTransaction) {
        const procUtils = new ProcessorUtils(request, serverTransaction, this.messageFactory)
        const response = this.locator.findEndpoint(ProcessorUtils.getAOR(request))

        if (response.status == Status.NOT_FOUND) {
            return procUtils.sendResponse(Response.TEMPORARILY_UNAVAILABLE)
        }

        // Call forking
        response.result.forEach(route => this.processRoute(request, serverTransaction, route))
    }

    processRoute(requestIn, serverTransaction, route) {
        const requestOut = requestIn.clone()
        const transport = requestIn.getHeader(ViaHeader.NAME).getTransport().toLowerCase()
        const lp = this.sipProvider.getListeningPoint(transport)
        const localAddr = { host: lp.getIPAddress().toString(), port: lp.getPort() }
        const advertisedAddr = this.getAdvertizedAddr(route, localAddr, this.config.spec.externAddr)

        LOG.debug('advertised addr: ' + JSON.stringify(advertisedAddr))
        LOG.debug('flow: ' + JSON.stringify(route))

        this.configureGeneral(requestOut, route, advertisedAddr)

        if(this.proxyOwnsRequest(requestOut, localAddr, advertisedAddr)) {
            requestOut.removeFirst(RouteHeader.NAME)
        }

        if(this.stayInSignalingPath()) {
            this.configureRecordRoute(requestOut, advertisedAddr)
        }

        if(route.thruGw) {
            this.configureRoutingHeaders(requestOut, route)
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

    configureGeneral(request, route, advertisedAddr) {
        const transport = request.getHeader(ViaHeader.NAME).getTransport().toLowerCase()
        request.setRequestURI(route.contactURI)
        const viaHeader = this.headerFactory
          .createViaHeader(advertisedAddr.host, advertisedAddr.port, transport, null)
        viaHeader.setRPort()
        request.addFirst(viaHeader)
        request.removeHeader("Proxy-Authorization")
        const maxForwardsHeader = request.getHeader(MaxForwardsHeader.NAME)
        maxForwardsHeader.decrementMaxForwards()
    }

    configureRecordRoute(request, advertisedAddr) {
        const proxyURI = this.addressFactory.createSipURI(null, advertisedAddr.host)
        proxyURI.setLrParam()
        proxyURI.setPort(advertisedAddr.port)
        const proxyAddress = this.addressFactory.createAddress(proxyURI)
        const recordRouteHeader = this.headerFactory.createRecordRouteHeader(proxyAddress)
        request.addHeader(recordRouteHeader)
    }

    configureRoutingHeaders(request, route) {
        // Lower the cseq to match the original request
        if (request.getMethod().equals(Request.INVITE)) {
            const cseq = request.getHeader(CSeqHeader.NAME).getSeqNumber() - 1
            request.getHeader(CSeqHeader.NAME).setSeqNumber(cseq)
        }
        const gwRefHeader = this.headerFactory.createHeader('X-Gateway-Ref', route.gwRef)
        const remotePartyIdHeader = this.headerFactory
            .createHeader('Remote-Party-ID', '<sip:'+ route.did + '@' + route.gwHost+ '>;screen=yes;party=calling')
        request.setHeader(gwRefHeader)
        request.setHeader(remotePartyIdHeader)
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
                port: externAddr.contains(":") ? externAddr.split(":")[1] : localAddr.port
            }
        }

        return { host: localAddr.host, port: localAddr.port }
    }

}

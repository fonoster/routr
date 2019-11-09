/**
 * @author Pedro Sanders
 * @since v1
 */
const LocatorUtils = require('@routr/location/utils')
const IPUtil = require('@routr/core/ip_util')
const {
    connectionException
} = require('@routr/utils/exception_helpers')
const {
    sendResponse
} = require('@routr/core/processor/processor_utils')
const {
    equalsIgnoreCase,
    fixPort
} = require('@routr/utils/misc_utils')
const {
    Status
} = require('@routr/core/status')
const config = require('@routr/core/config_util')()
const postal = require('postal')

const ObjectId = Java.type('org.bson.types.ObjectId')
const InetAddress = Java.type('java.net.InetAddress')
const SipFactory = Java.type('javax.sip.SipFactory')
const Request = Java.type('javax.sip.message.Request')
const Response = Java.type('javax.sip.message.Response')
const RouteHeader = Java.type('javax.sip.header.RouteHeader')
const CSeqHeader = Java.type('javax.sip.header.CSeqHeader')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const FromHeader = Java.type('javax.sip.header.FromHeader')
const MaxForwardsHeader = Java.type('javax.sip.header.MaxForwardsHeader')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const ConcurrentHashMap = Java.type('java.util.concurrent.ConcurrentHashMap')
const requestStore = new ConcurrentHashMap()
const headerFactory = SipFactory.getInstance().createHeaderFactory()
const addressFactory = SipFactory.getInstance().createAddressFactory()
const ipUtil = new IPUtil(config)
const LOG = LogManager.getLogger()

class RequestHandler {

    constructor(sipProvider, contextStorage) {
        this.sipProvider = sipProvider
        this.contextStorage = contextStorage

        postal.subscribe({
            channel: "locator",
            topic: "endpoint.find.reply",
            callback: (data, envelope) => {
                const requestInfo = requestStore.get(data.requestId)

                if (requestInfo === null) return

                const transaction = requestInfo.serverTransaction
                const routeInfo = requestInfo.routeInfo
                const request = requestInfo.request

                const response = data.response

                if (response.status == Status.NOT_FOUND) {
                    return sendResponse(transaction, Response.TEMPORARILY_UNAVAILABLE)
                }

                // Call forking
                response.data.forEach(route => this.processRoute(transaction, request, route, routeInfo))
                requestStore.remove(data.requestId)
            }
        })
    }

    doProcess(transaction, request, routeInfo) {
        const requestId = new ObjectId().toString()
        requestStore.put(requestId, {
            serverTransaction: transaction,
            request,
            routeInfo
        })
        postal.publish({
            channel: "locator",
            topic: "endpoint.find",
            data: {
                addressOfRecord: request.getRequestURI(),
                requestId: requestId
            }
        })
    }

    processRoute(transaction, requestIn, route, routeInfo) {
        const requestOut = requestIn.clone()
        const transport = requestIn.getHeader(ViaHeader.NAME).getTransport().toLowerCase()
        const lp = this.sipProvider.getListeningPoint(transport)
        const localAddr = {
            host: lp.getIPAddress().toString(),
            port: lp.getPort()
        }
        const advertisedAddr = RequestHandler.getAdvertizedAddr(route, localAddr, config.spec.externAddr)

        this.configureGeneral(requestOut, advertisedAddr, route, routeInfo)

        if (this.proxyOwnsRequest(requestOut, localAddr, advertisedAddr)) {
            requestOut.removeFirst(RouteHeader.NAME)
        }

        // Stay in signaling path
        if (config.spec.recordRoute) {
            this.configureRecordRoute(requestOut, advertisedAddr)
        }

        if (route.thruGw) {
            this.configureRoutingHeaders(requestOut, route)
        }

        LOG.debug(`core.processor.RequestHandler.processRoute [advertised addr ${JSON.stringify(advertisedAddr)}]`)
        LOG.debug(`core.processor.RequestHandler.processRoute [route ${JSON.stringify(route)}]`)

        this.sendRequest(transaction, requestIn, requestOut)
    }

    proxyOwnsRequest(request, localAddr, advertisedAddr) {
        const routeHeader = request.getHeader(RouteHeader.NAME)
        if (routeHeader) {
            const h = routeHeader.getAddress().getURI().getHost()
            const host = IPUtil.isIp(h) ? h : InetAddress.getByName(h).getHostAddress()
            const port = fixPort(routeHeader.getAddress().getURI().getPort())
            if (host.equals(advertisedAddr.host) && port === advertisedAddr.port) {
                return true
            }

            if (host.equals(localAddr.host) && port === localAddr.port) {
                return true
            }
        }
        return false
    }

    configureGeneral(request, advertisedAddr, route, routeInfo) {
        const transport = request.getHeader(ViaHeader.NAME).getTransport().toLowerCase()
        // XXX: This is probably wrong :( because I'm converting the contactURI to an aor.
        // by time the route gets here, the route should have a proper contactURI object.
        request.setRequestURI(LocatorUtils.aorAsObj(route.contactURI))
        const viaHeader = headerFactory
            .createViaHeader(advertisedAddr.host, advertisedAddr.port, transport, null)
        viaHeader.setRPort()
        request.addFirst(viaHeader)
        request.removeHeader("Proxy-Authorization")
        request.removeHeader("Privacy")
        const maxForwardsHeader = request.getHeader(MaxForwardsHeader.NAME)
        maxForwardsHeader.decrementMaxForwards()

        const callee = routeInfo.getCallee()

        if (callee && equalsIgnoreCase(callee.kind, 'agent')) {
            let factoryHeader

            if (callee.spec.privacy && equalsIgnoreCase(callee.spec.privacy, 'private')) {
                const originFromHeader = request.getHeader(FromHeader.NAME)
                const fromHeaderAddrs = addressFactory.createAddress(`"Anonymous" <sip:anonymous@anonymous.invalid>`)
                const fromHeader = headerFactory.createHeader('From', fromHeaderAddrs.toString())
                fromHeader.setTag(originFromHeader.getTag())
                request.setHeader(fromHeader)
                factoryHeader = headerFactory.createHeader('Privacy', 'id')
            } else {
                factoryHeader = headerFactory.createHeader('Privacy', 'none')
            }

            request.addHeader(factoryHeader)
        }
    }

    configureRecordRoute(request, advertisedAddr) {
        const proxyURI = addressFactory.createSipURI(null, advertisedAddr.host)
        proxyURI.setLrParam()
        proxyURI.setPort(advertisedAddr.port)
        const proxyAddress = addressFactory.createAddress(proxyURI)
        const recordRouteHeader = headerFactory.createRecordRouteHeader(proxyAddress)
        request.addHeader(recordRouteHeader)
    }

    configureRoutingHeaders(request, route) {
        // Lower the cseq to match the original request
        if (request.getMethod().equals(Request.INVITE)) {
            const cseq = request.getHeader(CSeqHeader.NAME).getSeqNumber() - 1
            request.getHeader(CSeqHeader.NAME).setSeqNumber(cseq)
        }
        const gwRefHeader = headerFactory.createHeader('X-Gateway-Ref', route.gwRef)
        const remotePartyIdHeader = headerFactory
            .createHeader('Remote-Party-ID', `<sip:${route.number}@${route.gwHost}>;screen=yes;party=calling`)
        const dp = request.getHeader(FromHeader.NAME).getAddress().getDisplayName()
        const displayName = dp ? `"${dp}" ` : ''
        const pAssertedIdentity = headerFactory
            .createHeader('P-Asserted-Identity', `${displayName}<sip:${route.number}@${route.gwHost}>`)
        request.setHeader(gwRefHeader)
        request.setHeader(remotePartyIdHeader)
        request.setHeader(pAssertedIdentity)
    }

    sendRequest(serverTransaction, requestIn, requestOut) {
        // Does not need a transaction
        if (requestIn.getMethod().equals(Request.ACK)) {
            return this.sipProvider.sendRequest(requestOut)
        }
        try {
            // The request must be cloned or the stack will not fork the call
            const clientTransaction = this.sipProvider.getNewClientTransaction(requestOut.clone())
            clientTransaction.sendRequest()

            LOG.debug(`core.processor.RequestHandler.sendRequest [clientTransactionId is ${clientTransaction.getBranchId()}]`)
            LOG.debug(`core.processor.RequestHandler.sendRequest [serverTransactionId is ${serverTransaction.getBranchId()}]`)
            LOG.debug(`core.processor.RequestHandler.sendRequest [request out is => \n${requestOut}]`)

            this.saveContext(requestIn, requestOut, clientTransaction, serverTransaction)
        } catch (e) {
            connectionException(e, requestOut.getRequestURI().getHost())
        }
    }

    saveContext(requestIn, requestOut, clientTransaction, serverTransaction) {
        // Transaction context
        const context = {}
        context.clientTransaction = clientTransaction
        context.serverTransaction = serverTransaction
        context.method = requestIn.getMethod()
        context.requestIn = requestIn
        context.requestOut = requestOut
        this.contextStorage.addContext(context)
    }

    static getAdvertizedAddr(route, localAddr, externAddr) {
        // No egress routing has sentByAddress. They are assume to be entities outside the local network.
        if (externAddr && (route.sentByAddress === undefined ||
                route.sentByAddress.endsWith(".invalid") ||
                !ipUtil.isLocalnet(route.sentByAddress))) {

            return {
                host: externAddr.contains(":") ? externAddr.split(":")[0] : externAddr,
                port: externAddr.contains(":") ? externAddr.split(":")[1] : localAddr.port
            }
        }

        return {
            host: localAddr.host,
            port: localAddr.port
        }
    }

}

module.exports = RequestHandler

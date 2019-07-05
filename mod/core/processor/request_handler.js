/**
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')
const ProcessorUtils = require('@routr/core/processor/utils')
const IPUtil = require('@routr/core/ip_util')
const getConfig = require('@routr/core/config_util')
const { Status } = require('@routr/core/status')
const LocatorUtils = require('@routr/location/utils')

const ObjectId = Java.type('org.bson.types.ObjectId')
const InetAddress = Java.type('java.net.InetAddress')
const SipFactory = Java.type('javax.sip.SipFactory')
const Request = Java.type('javax.sip.message.Request')
const Response = Java.type('javax.sip.message.Response')
const RouteHeader = Java.type('javax.sip.header.RouteHeader')
const CSeqHeader = Java.type('javax.sip.header.CSeqHeader')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const MaxForwardsHeader = Java.type('javax.sip.header.MaxForwardsHeader')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const ConcurrentHashMap = Java.type('java.util.concurrent.ConcurrentHashMap')
const requestStore = new ConcurrentHashMap()
const headerFactory = SipFactory.getInstance().createHeaderFactory()
const addressFactory = SipFactory.getInstance().createAddressFactory()
const ipUtil = new IPUtil(getConfig())
const config = getConfig()
const LOG = LogManager.getLogger()

class RequestHandler {

    constructor(sipProvider, dataAPIs, contextStorage) {
        this.sipProvider = sipProvider
        this.contextStorage = contextStorage

        postal.subscribe({
        		channel: "locator",
        		topic: "endpoint.find.reply",
        		callback: (data, envelope) => {
                const serverTransaction = requestStore.get(data.requestId)

                if (serverTransaction === null) return

                const response = data.response

                if (response.status == Status.NOT_FOUND) {
                    const procUtils = new ProcessorUtils(serverTransaction.getRequest(), serverTransaction)
                    return procUtils.sendResponse(Response.TEMPORARILY_UNAVAILABLE)
                }

                // Call forking
                response.result.forEach(route => this.processRoute(serverTransaction.getRequest(), serverTransaction, route))
                requestStore.remove(data.requestId)
        		}
      	})
    }

    doProcess(serverTransaction) {
        const requestId = new ObjectId().toString()
        requestStore.put(requestId, serverTransaction)
        postal.publish({
            channel: "locator",
            topic: "endpoint.find",
            data: {
                addressOfRecord: ProcessorUtils.getAOR(serverTransaction.getRequest()),
                requestId: requestId
            }
        })
    }

    processRoute(requestIn, serverTransaction, route) {
        const requestOut = requestIn.clone()
        const transport = requestIn.getHeader(ViaHeader.NAME).getTransport().toLowerCase()
        const lp = this.sipProvider.getListeningPoint(transport)
        const localAddr = { host: lp.getIPAddress().toString(), port: lp.getPort() }
        const advertisedAddr = this.getAdvertizedAddr(route, localAddr, config.spec.externAddr)

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


        LOG.debug(`core.processor.RequestHandler.processRoute [advertised addr ${JSON.stringify(advertisedAddr)}]`)
        LOG.debug(`core.processor.RequestHandler.processRoute [route ${JSON.stringify(route)}]`)
        this.sendRequest(requestIn, requestOut, serverTransaction)
    }

    stayInSignalingPath() {
        return config.spec.recordRoute? true : false
    }

    proxyOwnsRequest(request, localAddr, advertisedAddr) {
        const routeHeader = request.getHeader(RouteHeader.NAME)
        if (routeHeader) {
            const h = routeHeader.getAddress().getURI().getHost()
            const host = IPUtil.isIp(h)? h : InetAddress.getByName(h).getHostAddress()
            const port = routeHeader.getAddress().getURI().getPort() === -1? 5060 : routeHeader.getAddress().getURI().getPort()
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
        request.setRequestURI(LocatorUtils.aorAsObj(route.contactURI))
        const viaHeader = headerFactory
          .createViaHeader(advertisedAddr.host, advertisedAddr.port, transport, null)
        viaHeader.setRPort()
        request.addFirst(viaHeader)
        request.removeHeader("Proxy-Authorization")
        const maxForwardsHeader = request.getHeader(MaxForwardsHeader.NAME)
        maxForwardsHeader.decrementMaxForwards()
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

            LOG.debug(`core.processor.RequestHandler.sendRequest [clientTransactionId is ${clientTransaction.getBranchId()}]`)
            LOG.debug(`core.processor.RequestHandler.sendRequest [serverTransactionId is ${serverTransaction.getBranchId()}]`)
            LOG.debug(`core.processor.RequestHandler.sendRequest [request out is => \n${requestOut}]`)

            this.saveContext(requestIn, requestOut, clientTransaction, serverTransaction)
        } catch (e) {
            if (e instanceof Java.type('java.net.ConnectException')) {
                LOG.error('Connection refused. Please see: https://docs.oracle.com/javase/7/docs/api/java/net/ConnectException.html')
                return
            } else if (e instanceof Java.type('java.net.NoRouteToHostException')) {
                LOG.error('No route to host. Please see: https://docs.oracle.com/javase/7/docs/api/java/net/NoRouteToHostException.html')
                return
            } else if (e instanceof Java.type('javax.sip.TransactionUnavailableException')) {
                LOG.error('Could not resolve next hop or listening point unavailable!')
                return
            }
            LOG.error(e)
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

    getAdvertizedAddr(route, localAddr, externAddr) {
        // No egress routing has sentByAddress. They are assume to be entities outside the local network.
        if (externAddr && (route.sentByAddress === undefined
            || route.sentByAddress.endsWith(".invalid")
            || !ipUtil.isLocalnet(route.sentByAddress))) {

            return {
                host: externAddr.contains(":") ? externAddr.split(":")[0] : externAddr,
                port: externAddr.contains(":") ? externAddr.split(":")[1] : localAddr.port
            }
        }

        return { host: localAddr.host, port: localAddr.port }
    }

}

module.exports = RequestHandler

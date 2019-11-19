/**
 * @author Pedro Sanders
 * @since v1
 */
const {
    connectionException
} = require('@routr/utils/exception_helpers')
const {
    sendResponse
} = require('@routr/core/processor/processor_utils')
const {
    Status
} = require('@routr/core/status')
const config = require('@routr/core/config_util')()
const postal = require('postal')

const {
  getAdvertizedAddr,
  configureRoute,
  configureNextHop,
  configureProxyAuthorization,
  configureRequestURI,
  configureMaxForwards,
  configureContact,
  configurePrivacy,
  configureRecordRoute,
  configureIdentity,
  configureXHeaders,
  configureCSeq
} = require('@routr/core/processor/request_utils')

const ObjectId = Java.type('org.bson.types.ObjectId')
const Request = Java.type('javax.sip.message.Request')
const Response = Java.type('javax.sip.message.Response')
const RouteHeader = Java.type('javax.sip.header.RouteHeader')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const ConcurrentHashMap = Java.type('java.util.concurrent.ConcurrentHashMap')
const requestStore = new ConcurrentHashMap()

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

    processRoute(transaction, request, route, routeInfo) {
        const transport = request.getHeader(ViaHeader.NAME).getTransport()
            .toLowerCase()
        const lp = this.sipProvider.getListeningPoint(transport)
        const localAddr = {
            host: lp.getIPAddress().toString(),
            port: lp.getPort()
        }

        const advertisedAddr = getAdvertizedAddr(request, route, localAddr,
            config.spec.externAddr)

        let requestOut = configureMaxForwards(request)
        // requestOut = configureCSeq(requestOut)
        requestOut = configureProxyAuthorization(requestOut)
        requestOut = configureRoute(requestOut, advertisedAddr)
        requestOut = configureNextHop(requestOut, advertisedAddr)
        requestOut = configureRecordRoute(requestOut, advertisedAddr)
        requestOut = configurePrivacy(requestOut, routeInfo)
        requestOut = configureRequestURI(requestOut, routeInfo, route)
        requestOut = configureIdentity(requestOut, route)
        requestOut = configureXHeaders(requestOut, route)
        requestOut = configureContact(requestOut, route)

        LOG.debug(`core.processor.RequestHandler.processRoute [advertised addr ${JSON.stringify(advertisedAddr)}]`)
        LOG.debug(`core.processor.RequestHandler.processRoute [route ${JSON.stringify(route)}]`)

        this.sendRequest(transaction, request, requestOut)
    }

    sendRequest(serverTransaction, request, requestOut) {
        // Does not need a transaction
        if (request.getMethod().equals(Request.ACK)) {
            return this.sipProvider.sendRequest(requestOut)
        }
        try {
            // The request must be cloned or the stack will not fork the call
            const clientTransaction = this.sipProvider.getNewClientTransaction(requestOut.clone())
            clientTransaction.sendRequest()

            LOG.debug(`core.processor.RequestHandler.sendRequest [clientTransactionId is ${clientTransaction.getBranchId()}]`)
            LOG.debug(`core.processor.RequestHandler.sendRequest [serverTransactionId is ${serverTransaction.getBranchId()}]`)
            LOG.debug(`core.processor.RequestHandler.sendRequest [request out is => \n${requestOut}]`)

            this.saveContext(request, requestOut, clientTransaction, serverTransaction)
        } catch (e) {
            connectionException(e, requestOut.getRequestURI().getHost())
        }
    }

    saveContext(request, requestOut, clientTransaction, serverTransaction) {
        // Transaction context
        const context = {}
        context.clientTransaction = clientTransaction
        context.serverTransaction = serverTransaction
        context.method = request.getMethod()
        context.requestIn = request
        context.requestOut = requestOut
        this.contextStorage.addContext(context)
    }
}

module.exports = RequestHandler

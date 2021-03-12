/**
 * @author Pedro Sanders
 * @since v1
 */
const { connectionException } = require('@routr/utils/exception_helpers')
const {
  sendResponse,
  hasSDP,
  extractRTPEngineParams
} = require('@routr/core/processor/processor_utils')
const { Status } = require('@routr/core/status')
const config = require('@routr/core/config_util')()
const RTPEngineConnector = require('@routr/rtpengine/connector')
const ContentTypeHeader = Java.type('javax.sip.header.ContentTypeHeader')
const postal = require('postal')

const {
  getAdvertisedAddr,
  configureRoute,
  configureVia,
  configureProxyAuthorization,
  configureRequestURI,
  configureMaxForwards,
  configurePrivacy,
  configureRecordRoute,
  configureIdentity,
  configureXHeaders,
  configureCSeq,
  isInDialog
} = require('@routr/core/processor/request_utils')
const { directionFromRequest } = require('@routr/rtpengine/utils')
const { RoutingType } = require('@routr/core/routing_type')
const ObjectId = Java.type('org.bson.types.ObjectId')
const Request = Java.type('javax.sip.message.Request')
const Response = Java.type('javax.sip.message.Response')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const ToHeader = Java.type('javax.sip.header.ToHeader')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const ConcurrentHashMap = Java.type('java.util.concurrent.ConcurrentHashMap')
const requestStore = new ConcurrentHashMap()
const isInviteOrAck = r =>
  r.getMethod() === Request.INVITE || r.getMethod() === Request.ACK

const LOG = LogManager.getLogger()

class RequestHandler {
  constructor (sipProvider, contextStorage) {
    this.sipProvider = sipProvider
    this.contextStorage = contextStorage

    postal.subscribe({
      channel: 'locator',
      topic: 'endpoint.find.reply',
      callback: data => {
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
        response.data.forEach(route =>
          this.processRoute(transaction, request, route, routeInfo)
        )
        requestStore.remove(data.requestId)
      }
    })
  }

  doProcess (transaction, request, routeInfo) {
    const aor = config.spec.useToAsAOR
      ? request
          .getHeader(ToHeader.NAME)
          .getAddress()
          .getURI()
      : request.getRequestURI()

    if (isInDialog(request)) {
      this.processRoute(transaction, request, null, routeInfo)
    } else {
      const requestId = new ObjectId().toString()
      requestStore.put(requestId, {
        serverTransaction: transaction,
        request,
        routeInfo
      })
      postal.publish({
        channel: 'locator',
        topic: 'endpoint.find',
        data: {
          addressOfRecord: aor,
          requestId: requestId
        }
      })
    }
  }

  async processRoute (transaction, request, route, routeInfo) {
    try {
      const lpTransport = request
        .getHeader(ViaHeader.NAME)
        .getTransport()
        .toLowerCase()
      const targetTransport = route
        ? route.transport
        : request
            .getRequestURI()
            .getParameter('transport')
            .toLowerCase()

      const lp = this.sipProvider.getListeningPoint(lpTransport)
      const localAddr = {
        host: lp.getIPAddress().toString(),
        port: lp.getPort(),
        transport: lpTransport
      }
      const advertisedAddr = getAdvertisedAddr(
        request,
        route,
        localAddr,
        targetTransport
      )

      LOG.debug(
        `core.processor.RequestHandler.processRoute [targetTransport = ${targetTransport}]`
      )
      LOG.debug(
        `core.processor.RequestHandler.processRoute [lpTransport = ${lpTransport}]`
      )

      let requestOut = configureMaxForwards(request)
      requestOut = configureProxyAuthorization(requestOut)
      requestOut = configureRoute(requestOut, localAddr)
      requestOut = configureVia(requestOut, advertisedAddr, targetTransport)
      //requestOut = configureContact(requestOut)

      if (!isInDialog(request)) {
        requestOut = configureRequestURI(requestOut, routeInfo, route)
        requestOut = configurePrivacy(requestOut, routeInfo)
        requestOut = configureIdentity(requestOut, route)
        requestOut = configureXHeaders(requestOut, route)
        requestOut = configureRecordRoute(requestOut, localAddr, advertisedAddr)
      }

      if (routeInfo.getRoutingType() === RoutingType.DOMAIN_EGRESS_ROUTING) {
        // XXX: Please document this situation :(
        requestOut = configureCSeq(requestOut)
      }

      LOG.debug(
        `core.processor.RequestHandler.processRoute [advertised addr ${JSON.stringify(
          advertisedAddr
        )}]`
      )
      LOG.debug(
        `core.processor.RequestHandler.processRoute [route ${JSON.stringify(
          route
        )}]`
      )

      let bridgingNote
      if (isInviteOrAck(request) && hasSDP(request)) {
        // The note must be taken from the original request else it won't
        // have the correct transport.
        bridgingNote = directionFromRequest(request, route)
        const obj = await RTPEngineConnector.offer(
          bridgingNote,
          extractRTPEngineParams(request)
        )
        requestOut.setContent(
          obj.sdp,
          requestOut.getHeader(ContentTypeHeader.NAME)
        )
      }

      this.sendRequest(transaction, request, requestOut, bridgingNote)
    } catch (e) {
      LOG.error(e)
    }
  }

  sendRequest (serverTransaction, request, requestOut, bridgingNote) {
    // Does not need a transaction
    if (request.getMethod().equals(Request.ACK)) {
      return this.sipProvider.sendRequest(requestOut)
    }
    try {
      // The request must be cloned or the stack will not fork the call
      const clientTransaction = this.sipProvider.getNewClientTransaction(
        requestOut.clone()
      )
      clientTransaction.sendRequest()

      LOG.debug(
        `core.processor.RequestHandler.sendRequest [clientTransactionId is ${clientTransaction.getBranchId()}]`
      )
      LOG.debug(
        `core.processor.RequestHandler.sendRequest [serverTransactionId is ${serverTransaction.getBranchId()}]`
      )

      this.saveContext(
        request,
        requestOut,
        clientTransaction,
        serverTransaction,
        bridgingNote
      )
    } catch (e) {
      connectionException(e, requestOut.getRequestURI().getHost())
    }
  }

  saveContext (
    request,
    requestOut,
    clientTransaction,
    serverTransaction,
    bridgingNote
  ) {
    // Transaction context
    const context = {}
    context.clientTransaction = clientTransaction
    context.serverTransaction = serverTransaction
    context.method = request.getMethod()
    context.requestIn = request
    context.requestOut = requestOut
    context.bridgingNote = bridgingNote
    this.contextStorage.addContext(context)
  }
}

module.exports = RequestHandler

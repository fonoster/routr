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
const CallIdHeader = Java.type('javax.sip.header.CallIdHeader')
const FromHeader = Java.type('javax.sip.header.FromHeader')
const Request = Java.type('javax.sip.message.Request')
const LocatorUtils = require('@routr/location/utils')
const postal = require('postal')
const SipFactory = Java.type('javax.sip.SipFactory')
const headerFactory = SipFactory.getInstance().createHeaderFactory()

const {
  getEdgeAddr,
  configureContact,
  configureRouteV2,
  configureVia,
  configureProxyAuthorization,
  configureRequestURI,
  configureMaxForwards,
  configurePrivacy,
  configureRecordRoute,
  configureIdentity,
  configureXHeaders,
  isInDialog,
  getTargetTransport
} = require('@routr/core/processor/request_utils')
const { directionFromRequest } = require('@routr/rtpengine/utils')
const { RoutingType } = require('@routr/core/routing_type')
const ObjectId = Java.type('org.bson.types.ObjectId')
const Response = Java.type('javax.sip.message.Response')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const ToHeader = Java.type('javax.sip.header.ToHeader')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const ConcurrentHashMap = Java.type('java.util.concurrent.ConcurrentHashMap')
const requestStore = new ConcurrentHashMap()
const isInviteOrAck = r =>
  r.getMethod() === Request.INVITE || r.getMethod() === Request.ACK

const LOG = LogManager.getLogger(Java.type('io.routr.core.Launcher'))

class RequestHandler {
  constructor (sipProvider, contextStorage) {
    this.sipProvider = sipProvider
    this.contextStorage = contextStorage
    if (config.spec.ex_rtpEngine.enabled) {
      this.rtpeConnector = new RTPEngineConnector(config.spec.ex_rtpEngine)
    }

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

    // Hack :(
    // This forces the processor to look for an existing binding for endpoints
    // using ".invalid" in the host part of the contact(i.e: SIP.js)
    if (isInDialog(request) && !aor.toString().includes('.invalid')) {
      LOG.debug(
        `core.processor.RequestHandler.doProcess [Processing in-dialog message]`
      )
      this.processRoute(transaction, request, null, routeInfo)
    } else {
      LOG.debug(
        `core.processor.RequestHandler.doProcess [Processing dialog-creating message]`
      )
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
    LOG.debug('Incoming request <== \n' + request)
    try {
      // Request origin transport
      const originTransport = request
        .getHeader(ViaHeader.NAME)
        .getTransport()
        .toLowerCase()

      LOG.debug(
        `core.processor.RequestHandler.processRoute [originTransport = ${originTransport}]`
      )

      // Determining origin address
      const originAddr = request.getHeader(ViaHeader.NAME).getHost()

      LOG.debug(
        `core.processor.RequestHandler.processRoute [originAddr = ${originAddr}]`
      )

      // Determining Listening point for the originating SIP endpoint
      const originListeningPoint = this.sipProvider.getListeningPoint(
        originTransport
      )
      const originInterfaceAddr = {
        host: getEdgeAddr(
          originAddr,
          originListeningPoint.getIPAddress().toString(),
          null
        ),
        port: originListeningPoint.getPort(),
        transport: originTransport
      }

      LOG.debug(
        `core.processor.RequestHandler.processRoute [originInterfaceAddr = ${JSON.stringify(
          originInterfaceAddr
        )}]`
      )

      // Next hop transport protocol
      const targetTransport = getTargetTransport(route, request)

      LOG.debug(
        `core.processor.RequestHandler.processRoute [targetTransport = ${targetTransport}]`
      )

      // Determining target address
      const targetAddr =
        route && route.contactURI
          ? LocatorUtils.aorAsObj(route.contactURI).getHost()
          : request.getRequestURI().getHost()

      LOG.debug(
        `core.processor.RequestHandler.processRoute [targetAddr = ${targetAddr}]`
      )

      // Listening point for the destination SIP endpoint
      const targetListeningPoint = this.sipProvider.getListeningPoint(
        targetTransport
      )
      const targetInterfaceAddr = {
        host: getEdgeAddr(
          targetAddr,
          targetListeningPoint.getIPAddress().toString(),
          route
        ),
        port: targetListeningPoint.getPort(),
        transport: targetTransport
      }

      LOG.debug(
        `core.processor.RequestHandler.processRoute [targetInterfaceAddr = ${JSON.stringify(
          targetInterfaceAddr
        )}]`
      )

      let requestOut = configureMaxForwards(request)
      requestOut = configureContact(requestOut)
      requestOut = configureProxyAuthorization(requestOut)
      requestOut = configureRouteV2(
        requestOut,
        originInterfaceAddr,
        targetInterfaceAddr
      )
      requestOut = configureVia(
        requestOut,
        targetInterfaceAddr,
        targetTransport
      )

      // If route has accessKeyId, then add as an extra header
      if (route?.accessKeyId) {
        const accessKeyId = headerFactory.createHeader(
          'X-Access-Key-Id',
          route?.accessKeyId
        )
        requestOut.setHeader(accessKeyId)
      }

      if (!isInDialog(request)) {
        requestOut = configureRequestURI(requestOut, routeInfo, route)
        requestOut = configurePrivacy(requestOut, routeInfo)
        requestOut = configureIdentity(requestOut, route)
        requestOut = configureXHeaders(requestOut, route)
        requestOut = configureRecordRoute(
          requestOut,
          originInterfaceAddr,
          targetInterfaceAddr
        )
      } else if (route) {
        requestOut = configureRequestURI(requestOut, null, route)
      }

      let bridgingNote
      if (
        config.spec.ex_rtpEngine.enabled &&
        isInviteOrAck(request) &&
        hasSDP(request)
      ) {
        // The note must be taken from the original request else it won't
        // have the correct transport.
        bridgingNote = directionFromRequest(request, route)
        const obj = await this.rtpeConnector.offer(
          bridgingNote,
          extractRTPEngineParams(request)
        )
        requestOut.setContent(
          obj.sdp,
          requestOut.getHeader(ContentTypeHeader.NAME)
        )
      }

      if (request.getMethod() === Request.INVITE) {
        postal.publish({
          channel: 'processor',
          topic: 'call.started',
          data: {
            request: requestOut
          }
        })
      } else if (request.getMethod() === Request.BYE) {
        postal.publish({
          channel: 'processor',
          topic: 'call.end',
          data: {
            request: requestOut
          }
        })
      }

      if (
        request.getMethod() === Request.BYE &&
        config.spec.ex_rtpEngine.enabled
      ) {
        const callId = request.getHeader(CallIdHeader.NAME).getCallId()
        const fromTag = request.getHeader(FromHeader.NAME).getTag()
        await this.rtpeConnector.delete(callId, fromTag)
      }

      LOG.debug('Outgoing request ==> \n' + requestOut)
      this.sendRequest(transaction, request, requestOut, bridgingNote, route)
    } catch (e) {
      sendResponse(transaction, Response.SERVER_INTERNAL_ERROR)
      LOG.error(e.message || e)
    }
  }

  sendRequest (serverTransaction, request, requestOut, bridgingNote, route) {
    // Does not need a transaction
    if (request.getMethod().equals(Request.ACK)) {
      return this.sipProvider.sendRequest(requestOut)
    }
    try {
      // The request must be cloned or the stack will not fork the call
      const clientTransaction = this.sipProvider.getNewClientTransaction(
        requestOut.clone()
      )
      clientTransaction.setApplicationData(route)
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
      connectionException(
        e,
        requestOut.getRequestURI().getHost(),
        serverTransaction,
        route
      )
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

// Define imports
var SipListener         = Java.type('javax.sip.SipListener')
var Request             = Java.type('javax.sip.message.Request')
var RouteHeader         = Java.type('javax.sip.header.RouteHeader')
var ToHeader            = Java.type('javax.sip.header.ToHeader')
var ContactHeader       = Java.type('javax.sip.header.ContactHeader')
var ExpiresHeader       = Java.type('javax.sip.header.ExpiresHeader')
var ViaHeader           = Java.type('javax.sip.header.ViaHeader')
var CSeqHeader          = Java.type('javax.sip.header.CSeqHeader')
var AuthorizationHeader = Java.type('javax.sip.header.AuthorizationHeader')
var LogManager          = Java.type('org.apache.logging.log4j.LogManager')

load("mod/core/context.js")

function Processor(sipProvider, headerFactory, messageFactory, locationService, registrarService, config) {
    let LOG = LogManager.getLogger()
    let ctxtList = new java.util.ArrayList()

    // Generates WWW-Authorization header
    function generateChallenge() {
        let wwwAuthHeader = headerFactory.createWWWAuthenticateHeader("Digest")
        wwwAuthHeader.setDomain("fonoster.com")
        wwwAuthHeader.setRealm("sip.fonoster.com")
        wwwAuthHeader.setQop("auth")
        wwwAuthHeader.setOpaque("")
        wwwAuthHeader.setStale(false)
        wwwAuthHeader.setNonce("0ee55540a2e316dae22c804cdb383f5b")     // TODO: Generate a random nonce
        wwwAuthHeader.setAlgorithm("MD5")
        return wwwAuthHeader
    }

    function register (request, transaction) {
        let toHeader = request.getHeader(ToHeader.NAME)
        let toURI = toHeader.getAddress().getURI()
        let toDomain = toHeader.getAddress().getURI().getHost()
        let contactHeader = request.getHeader(ContactHeader.NAME)
        let contactURI = contactHeader.getAddress().getURI()
        let expH = request.getHeader(ExpiresHeader.NAME)
        let authHeader = request.getHeader(AuthorizationHeader.NAME)

        if (authHeader == null) {
            let unauthorized = messageFactory.createResponse(401, request)
            unauthorized.addHeader(generateChallenge())
            transaction.sendResponse(unauthorized)
            LOG.trace(unauthorized)
        } else {
            if (registrarService.register(authHeader, toDomain, contactURI)) {
                let ok = messageFactory.createResponse(200, request)
                ok.addHeader(contactHeader)
                ok.addHeader(expH)
                transaction.sendResponse(ok)
                LOG.trace("\n" + ok)
            } else {
                let unauthorized = messageFactory.createResponse(401, request)
                unauthorized.addHeader(generateChallenge())
                transaction.sendResponse(unauthorized)
                LOG.trace(unauthorized)
            }
        }
    }

    function cancel (request, transaction) {
        let iterator = ctxtList.iterator()

        while (iterator.hasNext()) {
            let ctxt = iterator.next()
            if (ctxt.serverTrans.getBranchId()
                .equals(transaction.getBranchId())) {

                let originRequest = ctxt.requestIn
                let originResponse = messageFactory.createResponse(487, originRequest)
                let cancelResponse = messageFactory.createResponse(200, request)
                let cancelRequest = ctxt.clientTrans.createCancel()
                let clientTransaction = sipProvider.getNewClientTransaction(cancelRequest)

                ctxt.serverTrans.sendResponse(originResponse)
                transaction.sendResponse(cancelResponse)
                clientTransaction.setRequest()

                LOG.trace(originResponse)
                LOG.trace(cancelResponse)
                LOG.trace(cancelRequest)
            }
        }
    }

    this.listener = new SipListener() {
        processRequest: function (e) {
            LOG.trace(e.getRequest())
            let localhost = InetAddress.getLocalHost().getHostAddress()
            let requestIn = e.getRequest()
            let routeHeader = requestIn.getHeader(RouteHeader.NAME)
            let proxyHost

            // Edge proxy
            if (routeHeader != null) {
                let sipURI = routeHeader.getAddress().getURI()
                proxyHost = sipURI.getHost()
            } else {
                proxyHost = localhost;
            }

            let method = requestIn.getMethod()
            let serverTransaction = e.getServerTransaction()

            if (serverTransaction == null) {
                serverTransaction = sipProvider.getNewServerTransaction(requestIn)
            }

            if (method.equals(Request.REGISTER)) {
                register(requestIn, serverTransaction)
            } else if(method.equals(Request.CANCEL)) {
                cancel(requestIn, serverTransaction)
            } else if(method.equals(Request.OPTIONS)) {
                // WARNING: NOT YET IMPLEMENTED
                return
            } else {
                let requestOut = requestIn.clone()
                let tgtURI = requestIn.getRequestURI()
                let tgtHost = tgtURI.getHost()

                // Last proxy in route
                if (proxyHost.equals(localhost)) {
                    let viaHeader = headerFactory.createViaHeader(proxyHost, config.port, config.proto, null)
                    requestOut.removeFirst(RouteHeader.NAME)
                    requestOut.addFirst(viaHeader)
                }

                // TODO: Respond UNAVAILABLE if the URI is not found by the Location Service
                let uri = locationService.get(tgtURI.toString())
                requestOut.setRequestURI(uri)

                // Not need transaction
                if(method.equals(Request.ACK)) {
                    sipProvider.sendRequest(requestOut)
                } else {
                    let clientTransaction = sipProvider.getNewClientTransaction(requestOut)
                    clientTransaction.sendRequest()

                    // Transaction context
                    let ctxt = new Context()
                    ctxt.clientTrans = clientTransaction
                    ctxt.serverTrans = serverTransaction
                    ctxt.method = method
                    ctxt.requestIn = requestIn
                    ctxt.requestOut = requestOut
                    ctxtList.add(ctxt)
                }

                LOG.trace(requestOut)
            }
        },

        processResponse: function (e) {
            let responseIn = e.getResponse()
            let statusCode = responseIn.getStatusCode()
            if (statusCode == 100 || statusCode == 487) return

            let responseOut = responseIn.clone()
            responseOut.removeFirst(ViaHeader.NAME)

            let clientTrans = e.getClientTransaction()
            let originalCSeq = clientTrans.getRequest().getHeader(CSeqHeader.NAME)
            let method = originalCSeq.getMethod()

            if (method.equals(Request.CANCEL)) return

            let i = ctxtList.iterator()

            let match = false
            while (i.hasNext()) {
                let ctxt = i.next()

                if (ctxt.clientTrans.equals(clientTrans)) {
                    ctxt.serverTrans.sendResponse(responseOut)
                    match = true
                    break
                }
            }

            if (!match) {
                sipProvider.sendResponse(responseOut)
            }

            LOG.trace(responseOut)
        },

        processTransactionTerminated: function (e) {
            if (e.isServerTransaction()) {
                let serverTrans = e.getServerTransaction()

                let i = ctxtList.iterator()

                while (i.hasNext()) {
                    let ctxt = i.next()

                    if (ctxt.serverTrans.equals(serverTrans)) {
                        ctxt.serverTrans.sendResponse(responseOut)
                        i.remove()
                        break
                    } else {
                        LOG.trace("Ongoing Transaction")
                    }
                }
            }
        }
    }
}

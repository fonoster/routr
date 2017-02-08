// Define imports
var SipListener         = Java.type('javax.sip.SipListener')
var Request             = Java.type('javax.sip.message.Request')
var Response            = Java.type('javax.sip.message.Response')
var RouteHeader         = Java.type('javax.sip.header.RouteHeader')
var ToHeader            = Java.type('javax.sip.header.ToHeader')
var ContactHeader       = Java.type('javax.sip.header.ContactHeader')
var ExpiresHeader       = Java.type('javax.sip.header.ExpiresHeader')
var ViaHeader           = Java.type('javax.sip.header.ViaHeader')
var CSeqHeader          = Java.type('javax.sip.header.CSeqHeader')
var AuthorizationHeader = Java.type('javax.sip.header.AuthorizationHeader')
var LogManager          = Java.type('org.apache.logging.log4j.LogManager')

load("mod/core/context.js")
load("mod/utils/auth_helper.js")

function Processor(sipProvider, sipStack, headerFactory, messageFactory, addressFactory, contactHeader, locationService,
    registrarService, accountManagerService, config) {

    let LOG = LogManager.getLogger()
    let ctxtList = new java.util.ArrayList()
    let localhost = InetAddress.getLocalHost().getHostAddress()
    let authHelper =  new AuthHelper(headerFactory)

    function register(request, transaction) {
        let toHeader = request.getHeader(ToHeader.NAME)
        let toURI = toHeader.getAddress().getURI()
        let toDomain = toHeader.getAddress().getURI().getHost()
        let contactHeader = request.getHeader(ContactHeader.NAME)
        let contactURI = contactHeader.getAddress().getURI()
        let expH = request.getHeader(ExpiresHeader.NAME)
        let authHeader = request.getHeader(AuthorizationHeader.NAME)

        if (authHeader == null) {
            let unauthorized = messageFactory.createResponse(Response.UNAUTHORIZED, request)
            unauthorized.addHeader(authHelper.generateChallenge())
            transaction.sendResponse(unauthorized)
            LOG.trace(unauthorized)
        } else {
            if (registrarService.register(authHeader, toDomain, contactURI)) {
                let ok = messageFactory.createResponse(Response.OK, request)
                ok.addHeader(contactHeader)
                ok.addHeader(expH)
                transaction.sendResponse(ok)
                LOG.trace("\n" + ok)
            } else {
                let unauthorized = messageFactory.createResponse(Response.UNAUTHORIZED, request)
                unauthorized.addHeader(authHelper.generateChallenge(headerFactory))
                transaction.sendResponse(unauthorized)
                LOG.trace(unauthorized)
            }
        }
    }

    function cancel(request, st) {
        let iterator = ctxtList.iterator()

        while (iterator.hasNext()) {
            let ctxt = iterator.next()
            if (ctxt.serverTrans.getBranchId()
                .equals(st.getBranchId())) {

                let originRequest = ctxt.requestIn
                let originResponse = messageFactory.createResponse(Response.REQUEST_TERMINATED, originRequest)
                let cancelResponse = messageFactory.createResponse(Response.OK, request)
                let cancelRequest = ctxt.clientTrans.createCancel()
                let ct = sipProvider.getNewClientTransaction(cancelRequest)

                ctxt.serverTrans.sendResponse(originResponse)
                st.sendResponse(cancelResponse)
                ct.sendRequest()

                LOG.trace(originResponse)
                LOG.trace(cancelResponse)
                LOG.trace(cancelRequest)
            }
        }
    }

    function unavailable(request, transaction) {
        LOG.debug("Unable to find contact: " + request.getHeader(ContactHeader.NAME))
        transaction.sendResponse(messageFactory.createResponse(Response.NOT_FOUND, request))
    }

    this.listener = new SipListener() {
        processRequest: function (e)    {
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
            let st = e.getServerTransaction()

            if (st == null) {
                st = sipProvider.getNewServerTransaction(requestIn)
            }

            if (method.equals(Request.REGISTER)) {
                register(requestIn, st)
            } else if(method.equals(Request.CANCEL)) {
                cancel(requestIn, st)
            } else if(method.equals(Request.OPTIONS)) {
                // WARNING: NOT YET IMPLEMENTED
            } else {
                let requestOut = requestIn.clone()
                let tgtURI = requestIn.getRequestURI()

                // Last proxy in route
                if (proxyHost.equals(localhost)) {
                    let viaHeader = headerFactory.createViaHeader(proxyHost, config.port, config.proto, null)
                    requestOut.removeFirst(RouteHeader.NAME)
                    requestOut.addFirst(viaHeader)
                }

                let uri = locationService.get(tgtURI)

                if (uri == null) {
                    unavailable(requestIn, st)
                    return
                }

                requestOut.setRequestURI(uri)

                // Not need transaction
                if(method.equals(Request.ACK)) {
                    sipProvider.sendRequest(requestOut)
                } else {
                    let ct = sipProvider.getNewClientTransaction(requestOut)
                    ct.sendRequest()

                    // Transaction context
                    let ctxt = new Context()
                    ctxt.clientTrans = ct
                    ctxt.serverTrans = st
                    ctxt.method = method
                    ctxt.requestIn = requestIn
                    ctxt.requestOut = requestOut
                    ctxtList.add(ctxt)
                }
                LOG.trace(requestOut)
            }
        },

        processResponse: function (e) {
            let rin = e.getResponse()
            let cseq = rin.getHeader(CSeqHeader.NAME)

            if (rin.getStatusCode() == Response.TRYING || rin.getStatusCode() == Response.REQUEST_TERMINATED) return
            if (cseq.getMethod().equals(Request.CANCEL)) return

            let ct = e.getClientTransaction()

            if (rin.getStatusCode() == Response.PROXY_AUTHENTICATION_REQUIRED || rin.getStatusCode() == Response.UNAUTHORIZED) {
                let authenticationHelper =
                    sipStack.getAuthenticationHelper(accountManagerService.getAccountManager(), headerFactory)
                let t = authenticationHelper.handleChallenge(rin, ct, e.getSource(), 5)
                t.sendRequest()
                return
            }

            if (cseq.getMethod().equals(Request.INVITE)) {
                if (ct != null) {
                    // In theory we should be able to obtain the ServerTransaction casting the ApplicationData.
                    // However, I'm unable to find the way to cast this object.
                    //let st = ct.getApplicationData()'

                    // Strip the topmost via header
                    let rout = rin.clone();
                    rout.removeFirst(ViaHeader.NAME);

                    let i = ctxtList.iterator()
                    while (i.hasNext()) {
                        let ctxt = i.next()

                        if (ctxt.clientTrans.equals(ct)) {
                            // The server tx goes to the terminated state.
                            ctxt.serverTrans.sendResponse(rout)
                            break
                        }
                    }
                } else {
                    // Client tx has already terminated but the UA is retransmitting
                    // just forward the response statelessly.
                    // Strip the topmost via header

                    let rout = rin.clone();
                    rout.removeFirst(ViaHeader.NAME);
                    // Send the retransmission statelessly
                    let sipProvider = e.getSource();
                    sipProvider.sendResponse(rout);
                }
            } else {
                // Can be BYE due to Record-Route
                LOG.trace("Got a non-invite response " + rin);
                let sipProvider = e.getSource();
                rin.removeFirst(ViaHeader.NAME);

                // There is no more Via headers; the response was intended for the proxy.
                if (rin.getHeader(ViaHeader.NAME) != null) sipProvider.sendResponse(rin);
            }
        },

        processTransactionTerminated: function (e) {
            if (e.isServerTransaction()) {
                let st = e.getServerTransaction()
                let i = ctxtList.iterator()

                while (i.hasNext()) {
                    let ctxt = i.next()

                    if (ctxt.serverTrans.equals(st)) {
                        i.remove()
                        break
                    } else {
                        LOG.info("Ongoing Transaction")
                    }
                }
            }
        },

        processDialogTerminated: function (e) {
            LOG.info("#processDialogTerminated not yet implemented")
        },

        processTimeout: function (e) {
            LOG.info("#processTimeout not yet implemented")
        }
    }
}

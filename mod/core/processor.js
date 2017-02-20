/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/core/context.js')
load('mod/utils/auth_helper.js')
load('mod/utils/acl_helper.js')
load('mod/utils/domain_utils.js')
load('mod/core/resources.js')

function Processor(sipProvider, sipStack, headerFactory, messageFactory, addressFactory, contactHeader, locationService,
    registrarService, accountManagerService, resourcesAPI, config) {
    //const config = config
    const InetAddress = Packages.java.net.InetAddress
    const SipListener = Packages.javax.sip.SipListener
    const Request = Packages.javax.sip.message.Request
    const Response = Packages.javax.sip.message.Response
    const RouteHeader = Packages.javax.sip.header.RouteHeader
    const ToHeader = Packages.javax.sip.header.ToHeader
    const ContactHeader = Packages.javax.sip.header.ContactHeader
    const ExpiresHeader = Packages.javax.sip.header.ExpiresHeader
    const ViaHeader = Packages.javax.sip.header.ViaHeader
    const CSeqHeader = Packages.javax.sip.header.CSeqHeader
    const AuthorizationHeader = Packages.javax.sip.header.AuthorizationHeader
    const LogManager = Packages.org.apache.logging.log4j.LogManager

    const LOG = LogManager.getLogger()
    const ctxtList = new java.util.ArrayList()
    const localhost = InetAddress.getLocalHost().getHostAddress()
    const authHelper =  new AuthHelper(headerFactory)

    const defaultDomainAcl = config.defaultDomainAcl

    function register(request, transaction) {
        const contactHeader = request.getHeader(ContactHeader.NAME)
        const contactURI = contactHeader.getAddress().getURI()
        const expH = request.getHeader(ExpiresHeader.NAME) || contactHeader.getExpires()
        const authHeader = request.getHeader(AuthorizationHeader.NAME)

        if (authHeader == null) {
            const unauthorized = messageFactory.createResponse(Response.UNAUTHORIZED, request)
            unauthorized.addHeader(authHelper.generateChallenge())
            transaction.sendResponse(unauthorized)
            LOG.trace(unauthorized)
        } else {
            if (registrarService.register(request)) {
                const ok = messageFactory.createResponse(Response.OK, request)
                ok.addHeader(contactHeader)
                ok.addHeader(expH)
                transaction.sendResponse(ok)
                LOG.trace("\n" + ok)
            } else {
                const unauthorized = messageFactory.createResponse(Response.UNAUTHORIZED, request)
                unauthorized.addHeader(authHelper.generateChallenge(headerFactory))
                transaction.sendResponse(unauthorized)
                LOG.trace(unauthorized)
            }
        }
    }

    function cancel(request, st) {
        const iterator = ctxtList.iterator()

        while (iterator.hasNext()) {
            const ctxt = iterator.next()
            if (ctxt.st.getBranchId()
                .equals(st.getBranchId())) {

                let originRequest = ctxt.rin
                let originResponse = messageFactory.createResponse(Response.REQUEST_TERMINATED, originRequest)
                let cancelResponse = messageFactory.createResponse(Response.OK, request)
                let cancelRequest = ctxt.ct.createCancel()
                let ct = sipProvider.getNewClientTransaction(cancelRequest)

                ctxt.st.sendResponse(originResponse)
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

    function reject(request, transaction) {
        LOG.debug("Connection rejected: " + request.getHeader(ContactHeader.NAME))
        transaction.sendResponse(messageFactory.createResponse(Response.UNAUTHORIZED, request))
    }

    this.listener = new SipListener() {
        processRequest: e => {
            const rin = e.getRequest()
            const method = rin.getMethod()
            const routeHeader = rin.getHeader(RouteHeader.NAME)
            const toHeader = rin.getHeader(ToHeader.NAME)
            const tgtURI = toHeader.getAddress().getURI()
            const contactHeader = rin.getHeader(ContactHeader.NAME)

            let st = e.getServerTransaction()
            let proxyHost

            // Edge proxy
            if (routeHeader != null) {
                const sipURI = routeHeader.getAddress().getURI()
                proxyHost = sipURI.getHost()
            } else {
                proxyHost = localhost;
            }

            if (st == null && !method.equals(Request.ACK)) {
                st = sipProvider.getNewServerTransaction(rin)
            }

            const domain = resourcesAPI.findDomain(tgtURI.getHost())
            if (domain == null) reject(rin, st)

            if(!new DomainUtil(domain, defaultDomainAcl).isDomainAllow(domain, tgtURI.getHost())) {
                LOG.trace("Host " + contactURI.getHost() + " has been rejected by " + domain.uri)
                reject(rin, st)
            }

            if (method.equals(Request.REGISTER)) {
                register(rin, st)
            } else if(method.equals(Request.CANCEL)) {
                cancel(rin, st)
            } else {
                const rout = rin.clone()

                // Last proxy in route
                if (proxyHost.equals(localhost)) {
                    const viaHeader = headerFactory.createViaHeader(proxyHost, config.port, 'udp', null)
                    rout.removeFirst(RouteHeader.NAME)
                    rout.addFirst(viaHeader)
                }

                const uri = locationService.get(tgtURI)

                if (uri == null) {
                    unavailable(rin, st)
                    return
                }

                rout.setRequestURI(uri)

                // Not need transaction
                if(method.equals(Request.ACK)) {
                    sipProvider.sendRequest(rout)
                } else {
                    const ct = sipProvider.getNewClientTransaction(rout)
                    ct.sendRequest()

                    // Transaction context
                    const ctxt = new Context()
                    ctxt.ct = ct
                    ctxt.st = st
                    ctxt.method = method
                    ctxt.rin = rin
                    ctxt.rout = rout
                    ctxtList.add(ctxt)
                }
                LOG.trace(rout)
            }
        },

        processResponse: e => {
            const rin = e.getResponse()
            const cseq = rin.getHeader(CSeqHeader.NAME)

            if (rin.getStatusCode() == Response.TRYING || rin.getStatusCode() == Response.REQUEST_TERMINATED) return
            if (cseq.getMethod().equals(Request.CANCEL)) return

            let ct = e.getClientTransaction()

            // WARNING: This is causing an issue with TCP transport
            if (rin.getStatusCode() == Response.PROXY_AUTHENTICATION_REQUIRED || rin.getStatusCode() == Response.UNAUTHORIZED) {
                let authenticationHelper =
                    sipStack.getAuthenticationHelper(accountManagerService.getAccountManager(), headerFactory)
                //if (ct == null) ct = sipProvider.getNewClientTransaction(rin)
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
                    const rout = rin.clone();
                    rout.removeFirst(ViaHeader.NAME);

                    const i = ctxtList.iterator()
                    while (i.hasNext()) {
                        const ctxt = i.next()

                        if (ctxt.ct.equals(ct)) {
                            // The server tx goes to the terminated state.
                            ctxt.st.sendResponse(rout)
                            break
                        }
                    }
                } else {
                    // Client tx has already terminated but the UA is retransmitting
                    // just forward the response statelessly.
                    // Strip the topmost via header

                    const rout = rin.clone();
                    rout.removeFirst(ViaHeader.NAME);
                    // Send the retransmission statelessly
                    const sipProvider = e.getSource();
                    sipProvider.sendResponse(rout);
                }
            } else {
                // Can be BYE due to Record-Route
                LOG.trace("Got a non-invite response " + rin);
                const sipProvider = e.getSource();
                rin.removeFirst(ViaHeader.NAME);

                // There is no more Via headers; the response was intended for the proxy.
                if (rin.getHeader(ViaHeader.NAME) != null) sipProvider.sendResponse(rin);
            }
        },

        processTransactionTerminated: e => {
            if (e.isServerTransaction()) {
                const st = e.getServerTransaction()
                const i = ctxtList.iterator()

                while (i.hasNext()) {
                    const ctxt = i.next()

                    if (ctxt.st.equals(st)) {
                        i.remove()
                        break
                    } else {
                        LOG.info("Ongoing Transaction")
                    }
                }
            }
        },

        processDialogTerminated: e => {
            LOG.info("#processDialogTerminated not yet implemented")
        },

        processTimeout: e => {
            LOG.info("#processTimeout not yet implemented")
        }
    }
}

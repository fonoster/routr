/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/core/context.js')
load('mod/utils/auth_helper.js')
load('mod/utils/acl_helper.js')
load('mod/utils/domain_utils.js')
load('mod/core/resources.js')

function Processor(sipProvider, headerFactory, messageFactory, addressFactory, contactHeader, locationService,
    registrarService, accountManagerService, resourcesAPI, contextStorage, config) {
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
    const ProxyAuthorizationHeader = Packages.javax.sip.header.ProxyAuthorizationHeader
    const LogManager = Packages.org.apache.logging.log4j.LogManager

    const LOG = LogManager.getLogger()
    const authHelper =  new AuthHelper(headerFactory)

    const defaultDomainAcl = config.defaultDomainAcl

    function register(request, transaction) {
        const contactHeader = request.getHeader(ContactHeader.NAME)
        const contactURI = contactHeader.getAddress().getURI()
        const expH = request.getHeader(ExpiresHeader.NAME) || contactHeader.getExpires()
        const authHeader = request.getHeader(AuthorizationHeader.NAME)

        LOG.debug('<-------\n' + request)

        if (authHeader == null) {
            const unauthorized = messageFactory.createResponse(Response.UNAUTHORIZED, request)
            unauthorized.addHeader(authHelper.generateChallenge())
            transaction.sendResponse(unauthorized)
            LOG.debug('------->\n' + unauthorized)
        } else {
            if (registrarService.register(request)) {
                const ok = messageFactory.createResponse(Response.OK, request)
                ok.addHeader(contactHeader)
                ok.addHeader(expH)
                transaction.sendResponse(ok)
                LOG.debug('------->\n' + ok)
            } else {
                const unauthorized = messageFactory.createResponse(Response.UNAUTHORIZED, request)
                unauthorized.addHeader(authHelper.generateChallenge(headerFactory))
                transaction.sendResponse(unauthorized)
                LOG.debug('------->\n' + unauthorized)
            }
        }
    }

    function cancel(request, serverTransaction) {
        const storage = contextStorage.getStorage()
        const iterator = storage.iterator()

        while (iterator.hasNext()) {
            const context = iterator.next()
            if (context.serverTransaction && context.serverTransaction.getBranchId()
                .equals(serverTransaction.getBranchId())) {

                let originRequest = context.requestIn
                let originResponse = messageFactory.createResponse(Response.REQUEST_TERMINATED, originRequest)
                let cancelResponse = messageFactory.createResponse(Response.OK, request)
                let cancelRequest = context.clientTransaction.createCancel()
                let clientTransaction = sipProvider.getNewClientTransaction(cancelRequest)

                context.serverTransaction.sendResponse(originResponse)
                serverTransaction.sendResponse(cancelResponse)
                clientTransaction.sendRequest()

                LOG.trace('Original response: ' + originResponse)
                LOG.trace('Cancel response: ' + cancelResponse)
                LOG.trace('Cancel request: ' + cancelRequest)
            }
        }
        LOG.debug('<-------\n' + request)
    }

    function unavailable(request, transaction) {
        LOG.trace('Unable to find contact: ' + request.getHeader(ToHeader.NAME))
        transaction.sendResponse(messageFactory.createResponse(Response.NOT_FOUND, request))
        LOG.debug('------->\n' + request)
    }

    function reject(request, transaction) {
        transaction.sendResponse(messageFactory.createResponse(Response.UNAUTHORIZED, request))
        LOG.debug('------->\n' + request)
    }

    this.listener = new SipListener() {
        processRequest: event => {
            const requestIn = event.getRequest()
            const method = requestIn.getMethod()
            const routeHeader = requestIn.getHeader(RouteHeader.NAME)
            const toHeader = requestIn.getHeader(ToHeader.NAME)
            const requestVia = requestIn.getHeader(ViaHeader.NAME)
            const tgtURI = toHeader.getAddress().getURI()

            let serverTransaction = event.getServerTransaction()
            let proxyHost

            // Edge proxy
            if (routeHeader == null) {
                proxyHost = config.ip;
            } else {
                const sipURI = routeHeader.getAddress().getURI()
                proxyHost = sipURI.getHost()
            }

            if (serverTransaction == null && !method.equals(Request.ACK)) {
                serverTransaction = sipProvider.getNewServerTransaction(requestIn)
            }

            const domain = resourcesAPI.findDomain(tgtURI.getHost())

            if (domain != null) {
                if(!new DomainUtil(defaultDomainAcl).isDomainAllow(domain, tgtURI.getHost())) {
                    reject(requestIn, serverTransaction)
                }
            }

            const requestOut = requestIn.clone()

            if (method.equals(Request.REGISTER)) {
                register(requestIn, serverTransaction)
                return
            } else if(method.equals(Request.CANCEL)) {
                cancel(requestIn, serverTransaction)
                return
            } else {
                // Last proxy in route
                if (proxyHost.equals(config.ip) || proxyHost.equals(config.externalIp)) {
                    const transport = requestVia.getTransport().toLowerCase()
                    const port = sipProvider.getListeningPoint(transport).getPort()
                    const viaHeader = headerFactory.createViaHeader(proxyHost, port, transport, null)

                    // Why do I remove this header here?
                    requestOut.removeFirst(RouteHeader.NAME)
                    requestOut.addFirst(viaHeader)
                }

                // Discover DIDs sent via a non-standard header
                // The header must be added at config.addressInfo[*]
                let address = null

                config.addressInfo.forEach(function(info) {
                    if (requestIn.getHeader(info) != null) address = 'tel:' + requestIn.getHeader(info)
                })

                const tgt = address || tgtURI
                const contact = locationService.get(tgt)

                if (contact == null) {
                    unavailable(requestIn, serverTransaction)
                    return
                }

                requestOut.setRequestURI(contact)

                // Does not need a transaction
                if(method.equals(Request.ACK)) {
                    sipProvider.sendRequest(requestOut)
                } else {
                    try {
                        const clientTransaction = sipProvider.getNewClientTransaction(requestOut)
                        clientTransaction.sendRequest()

                        // Transaction context
                        const context = new Context()
                        context.clientTransaction = clientTransaction
                        context.serverTransaction = serverTransaction
                        context.method = method
                        context.requestIn = requestIn
                        context.requestOut = requestOut
                        contextStorage.saveContext(context)
                    } catch (e) {
                        LOG.info(e.getMessage())
                        LOG.trace(e.getStackTrace())
                    }
                }
            }
            LOG.debug('<-------\n' + requestOut)
        },

        processResponse: event => {
            const responseIn = event.getResponse()
            const cseq = responseIn.getHeader(CSeqHeader.NAME)

            if (responseIn.getStatusCode() == Response.TRYING ||
                responseIn.getStatusCode() == Response.REQUEST_TERMINATED) return
            if (cseq.getMethod().equals(Request.CANCEL)) return

            const clientTransaction = event.getClientTransaction()

            // WARNING: This is causing an issue with TCP transport and DIDLogic
            // I suspect that DIDLogic does not fully support tcp registration
            if (responseIn.getStatusCode() == Response.PROXY_AUTHENTICATION_REQUIRED ||
                responseIn.getStatusCode() == Response.UNAUTHORIZED) {

                let authenticationHelper = sipProvider.getSipStack()
                    .getAuthenticationHelper(accountManagerService.getAccountManager(), headerFactory)

                let t = authenticationHelper.handleChallenge(responseIn, clientTransaction, event.getSource(), 5)
                t.sendRequest()

                LOG.debug('<-------\n' + responseIn)
                return
            }

            // Strip the topmost via header
            const responseOut = responseIn.clone();
            responseOut.removeFirst(ViaHeader.NAME);

            /*if (cseq.getMethod().equals(Request.INVITE) && responseIn.getStatusCode() == Response.OK) {
                LOG.debug('Call originated from API')
                const dialog = clientTransaction.getDialog()
                const ackRequest = dialog.createAck(cseq.getSequenceNumber())
                dialog.sendAck(ackRequest)
            } else*/ if (cseq.getMethod().equals(Request.INVITE)) {
                if (clientTransaction != null) {
                    // In theory we should be able to obtain the ServerTransaction casting the ApplicationData.
                    // However, I'm unable to find the way to cast this object.
                    //let st = clientTransaction.getApplicationData()'

                    const context = contextStorage.findContext(clientTransaction)
                    // serverTransaction will be undefined when using the Originate functionality
                    if (context.serverTransaction) context.serverTransaction.sendResponse(responseOut)
                } else {
                    // Client tx has already terminated but the UA is retransmitting
                    // just forward the response statelessly.
                    // Send the retransmission statelessly
                    if (responseIn.getHeader(ViaHeader.NAME) != null) sipProvider.sendResponse(responseOut);
                }
            } else {
                // Could be a BYE due to Record-Route
                // There is no more Via headers; the response was intended for the proxy.
                if (responseOut.getHeader(ViaHeader.NAME) != null) sipProvider.sendResponse(responseOut);
            }
            LOG.debug('------->\n' + responseOut)
        },

        processTransactionTerminated: event => {
            if (event.isServerTransaction()) {
                const serverTransaction = event.getServerTransaction()

                if (!contextStorage.removeContext(serverTransaction)) {
                   LOG.trace("Ongoing Transaction")
                }
            }
        },

        processDialogTerminated: event => {
            LOG.trace('Dialog ' + event.getDialog() + ' has been terminated')
        },

        processTimeout: event => {
            LOG.trace('Transaction Time out')
        }
    }
}

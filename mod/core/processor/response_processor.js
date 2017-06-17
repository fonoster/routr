/**
 * @author Pedro Sanders
 * @since v1
 */
import AccountManagerService from 'core/account_manager_service'

const SipFactory = Packages.javax.sip.SipFactory
const SipListener = Packages.javax.sip.SipListener
const FromHeader = Packages.javax.sip.header.FromHeader
const ViaHeader = Packages.javax.sip.header.ViaHeader
const CSeqHeader = Packages.javax.sip.header.CSeqHeader
const ExpiresHeader = Packages.javax.sip.header.ExpiresHeader
const Request = Packages.javax.sip.message.Request
const Response = Packages.javax.sip.message.Response
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()

export default class ResponseProcessor {

    constructor(sipProvider, locator, registry, registrar, dataAPIs, contextStorage) {
        this.sipProvider = sipProvider
        this.registry = registry
        this.contextStorage = contextStorage
        this.headerFactory = SipFactory.getInstance().createHeaderFactory()
        this.accountManagerService = new AccountManagerService(dataAPIs)
    }

    process(event) {
        const responseIn = event.getResponse()
        const cseq = responseIn.getHeader(CSeqHeader.NAME)
        const expiresHeader = responseIn.getHeader(ExpiresHeader.NAME)
        const fromHeader = responseIn.getHeader(FromHeader.NAME)
        const fromURI = fromHeader.getAddress().getURI()
        const viaHeader = responseIn.getHeader(ViaHeader.NAME)
        const clientTransaction = event.getClientTransaction()

        // The stack takes care of this cases
        if (responseIn.getStatusCode() == Response.TRYING ||
            responseIn.getStatusCode() == Response.REQUEST_TERMINATED ||
            cseq.getMethod().equals(Request.CANCEL)) return

        if (cseq.getMethod().equals(Request.REGISTER) &&
            responseIn.getStatusCode() == Response.OK) {

            const request = clientTransaction.getRequest()
            const gwRef = request.getHeader('GwRef').value

            const rPort = viaHeader.getRPort()
            const port = viaHeader.getPort()
            const host = viaHeader.getHost()
            const received = viaHeader.getReceived()

            if ((!!received && !host.equals(received)) || port != rPort) {
                const username = fromURI.getUser()
                const transport = viaHeader.getTransport().toLowerCase()
                // This may not be the best source to get this parameter
                const peerHost = fromURI.getHost()

                LOG.debug('Sip I/O is behind a NAT. Re-registering using Received and RPort')
                try {
                    this.registry.requestChallenge(username, gwRef, peerHost, transport, received, rPort)
                } catch(e) {
                    e.printStackTrace()
                }
                return
            }

            let expires = 300
            if(expiresHeader != null) expires = expiresHeader.getExpires()
            this.registry.storeRegistry(fromURI.getUser(), fromURI.getHost(), expires)
        } else if(cseq.getMethod().equals(Request.REGISTER)) {
            this.registry.removeRegistry(fromURI.getHost())
        }

        // WARNING: This is causing an issue with tcp transport and DIDLogic
        // I believe that DIDLogic does not fully support tcp registration
        if (responseIn.getStatusCode() == Response.PROXY_AUTHENTICATION_REQUIRED ||
            responseIn.getStatusCode() == Response.UNAUTHORIZED) {
            let authenticationHelper = this.sipProvider.getSipStack()
                .getAuthenticationHelper(this.accountManagerService.getAccountManager(), this.headerFactory)
            let t = authenticationHelper.handleChallenge(responseIn, clientTransaction, event.getSource(), 5)
            t.sendRequest()
            LOG.debug(responseIn)
            return
        }

        // Strip the topmost via header
        const responseOut = responseIn.clone()
        responseOut.removeFirst(ViaHeader.NAME)

        if (cseq.getMethod().equals(Request.INVITE) && !!clientTransaction) {
            // In theory we should be able to obtain the ServerTransaction casting the ApplicationData.
            // However, I'm unable to find the way to cast this object.
            //let st = clientTransaction.getApplicationData()'
            const context = this.contextStorage.findContext(clientTransaction)

            if (!!context && !!context.serverTransaction) context.serverTransaction.sendResponse(responseOut)

        } else {
            // Could be a BYE due to Record-Route
            // There is no more Via headers; the response was intended for the proxy.
            if (!!responseOut.getHeader(ViaHeader.NAME)) this.sipProvider.sendResponse(responseOut)
        }
        LOG.debug(responseOut)
    }
}

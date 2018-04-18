/**
 * @author Pedro Sanders
 * @since v1
 */
import AccountManagerService from 'core/account_manager_service'

const SipFactory = Packages.javax.sip.SipFactory
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
        const response = event.getResponse()

        // The stack takes care of this cases
        if (ResponseProcessor.isStackJob(response)) {
            return
        }

        if (ResponseProcessor.isRegisterOk(response)) {
            const viaHeader = response.getHeader(ViaHeader.NAME)
            if (ResponseProcessor.isBehindNat(viaHeader)) {
                return this.reRegister(event)
            }
        } else if(ResponseProcessor.isRegisterNok(response)) {
            this.removeFromRegistry(response)
        }

        ResponseProcessor.mustAuthenticate(response)? this.sendAuthChallenge(event)
            : this.sendResponse(event)
    }

    static mustAuthenticate(response) {
        if(response.getStatusCode() == Response.PROXY_AUTHENTICATION_REQUIRED ||
          response.getStatusCode() == Response.UNAUTHORIZED) {
            return true
        }
        return false
    }

    static isStackJob(response) {
        if(response.getStatusCode() == Response.TRYING              ||
            response.getStatusCode() == Response.REQUEST_TERMINATED ||
            response.getHeader(CSeqHeader.NAME).getMethod()
              .equals(Request.CANCEL)) {
              return true
        }
        return false
    }

    static isBehindNat(viaHeader) {
        const rPort = viaHeader.getRPort()
        const port = viaHeader.getPort()
        const host = viaHeader.getHost()
        const received = viaHeader.getReceived()
        return (!!received && !host.equals(received)) || port != rPort? true : false
    }

    static isRegister(response) {
        const cseq = response.getHeader(CSeqHeader.NAME)
        return cseq.getMethod().equals(Request.REGISTER)? true : false
    }

    static isRegisterOk(response) {
        if(ResponseProcessor.isRegister(response) && response.getStatusCode() == Response.OK) {
            return true
        }
        return false
    }

    static isRegisterNok(response) {
        if(response.getStatusCode() != Response.OK && ResponseProcessor.isRegister(response)) {
            return true
        }
        return false
    }

    static isInviteWithCT(event) {
        const clientTransaction = event.getClientTransaction()
        const cseq = event.getResponse().getHeader(CSeqHeader.NAME)
        return cseq.getMethod().equals(Request.INVITE) && clientTransaction != null? true : false
    }

    storeInRegistry(response) {
        const fromURI = response.getHeader(FromHeader.NAME).getAddress().getURI()
        const expiresHeader = response.getHeader(ExpiresHeader.NAME)
        const expires  = expiresHeader != null? expiresHeader.getExpires() : 300
        this.registry.storeRegistry(fromURI.getUser(), fromURI.getHost(), expires)
    }

    removeFromRegistry(response) {
        const fromURI = response.getHeader(FromHeader.NAME).getAddress().getURI()
        this.registry.removeRegistry(fromURI.getHost())
    }

    sendAuthChallenge(event) {
        const authHelper = this.sipProvider
            .getSipStack()
                .getAuthenticationHelper(this.accountManagerService
                    .getAccountManager(), this.headerFactory)
        authHelper.handleChallenge(
            event.getResponse(), event.getClientTransaction(),
              event.getSource(), 5).sendRequest()
    }

    reRegister(event) {
        const response = event.getResponse()
        const clientTransaction = event.getClientTransaction()
        const viaHeader = response.getHeader(ViaHeader.NAME)

        LOG.debug('Sip I/O is behind a NAT. Re-registering using Received and RPort')

        try {
            const fromURI = response.getHeader(FromHeader.NAME).getAddress().getURI()
            const gwRef = clientTransaction.getRequest().getHeader('X-Gateway-Ref').value
            this.registry.requestChallenge(fromURI.getUser(),
                gwRef,
                fromURI.getHost(),
                viaHeader.getTransport().toLowerCase(),
                viaHeader.getReceived(),
                viaHeader.getRPort())
        } catch(e) {
            LOG.error(e)
        }
    }

    sendResponse(event) {
        const responseOut = event.getResponse().clone()

        // Strip the topmost via header
        responseOut.removeFirst(ViaHeader.NAME)

        if (ResponseProcessor.isInviteWithCT(event)) {
            // In theory we should be able to obtain the ServerTransaction casting the ApplicationData.
            // However, I'm unable to find the way to cast this object.
            //let st = clientTransaction.getApplicationData()'
            const context = this.contextStorage.findContext(event.getClientTransaction())

            if (context != null && context.serverTransaction != null) {
                context.serverTransaction.sendResponse(responseOut)
            } else if (responseOut.getHeader(ViaHeader.NAME) != null) {
                this.sipProvider.sendResponse(responseOut)
            }
        } else if(responseOut.getHeader(ViaHeader.NAME) != null) {
            // Could be a BYE due to Record-Route
            // There is no more Via headers; the response was intended for the proxy.
            this.sipProvider.sendResponse(responseOut)
        }
        LOG.debug(responseOut)
    }
}

/**
 * @author Pedro Sanders
 * @since v1
 */
import AccountManagerService from 'core/account_manager_service'

const SipFactory = Packages.javax.sip.SipFactory
const FromHeader = Packages.javax.sip.header.FromHeader
const ViaHeader = Packages.javax.sip.header.ViaHeader
const ContactHeader = Packages.javax.sip.header.ContactHeader
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
            if (ResponseProcessor.isBehindNat(response)) {
                return this.reRegister(event)
            }
            this.storeInRegistry(response)
        } else if(ResponseProcessor.isRegisterNok(response)) {
            this.removeFromRegistry(response)
        }

        ResponseProcessor.mustAuthenticate(response)? this.handleAuthChallenge(event)
            : this.sendResponse(event)
    }

    storeInRegistry(response) {
        const fromURI = response.getHeader(FromHeader.NAME).getAddress().getURI()
        const expiresHeader = response.getHeader(ExpiresHeader.NAME)
        const expires  = expiresHeader != null? expiresHeader.getExpires() : 3600
        this.registry.storeRegistry(fromURI, expires)
    }

    removeFromRegistry(response) {
        const fromURI = response.getHeader(FromHeader.NAME).getAddress().getURI()
        this.registry.removeRegistry(fromURI.toString())
    }

    handleAuthChallenge(event) {
        const authHelper = this.sipProvider
            .getSipStack()
                .getAuthenticationHelper(this.accountManagerService
                    .getAccountManager(), this.headerFactory)
        // Setting looseRouting to false will cause https://github.com/fonoster/routr/issues/18
        authHelper.handleChallenge(
            event.getResponse(), event.getClientTransaction(),
              event.getSource(), 5, true).sendRequest()
    }

    reRegister(event) {
        const response = event.getResponse()
        const clientTransaction = event.getClientTransaction()
        const viaHeader = response.getHeader(ViaHeader.NAME)
        const expires = response.getHeader(ExpiresHeader.NAME).getExpires()

        LOG.debug('Routr is behind a NAT. Re-registering using Received and RPort')

        try {
            const fromURI = response.getHeader(FromHeader.NAME).getAddress().getURI()
            const gwRef = clientTransaction.getRequest().getHeader('X-Gateway-Ref').value
            this.registry.requestChallenge(fromURI.getUser(),
                gwRef,
                fromURI.getHost(),
                viaHeader.getTransport().toLowerCase(),
                viaHeader.getReceived(),
                viaHeader.getRPort(),
                expires)
        } catch(e) {
            LOG.error(e)
        }
    }

    sendResponse(event) {
        const responseOut = event.getResponse().clone()
        responseOut.removeFirst(ViaHeader.NAME)

        if (ResponseProcessor.isInviteWithCT(event)) {
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

    static isOk(response) {
        return response.getStatusCode() == Response.OK
    }

    static mustAuthenticate(response) {
        if(response.getStatusCode() == Response.PROXY_AUTHENTICATION_REQUIRED ||
          response.getStatusCode() == Response.UNAUTHORIZED) {
            return true
        }
        return false
    }

    static isInvite(response) {
        return response.getHeader(CSeqHeader.NAME).getMethod().equals(Request.INVITE)
    }

    static isInviteOk(response) {
        return ResponseProcessor.isInvite(response) && ResponseProcessor.isOk(response)
    }

    static isInviteNok(response) {
        return ResponseProcessor.isInvite(response) && !ResponseProcessor.isOk(response)
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

    static isBehindNat(response) {
        const viaHeader = response.getHeader(ViaHeader.NAME)
        const contactHeader = response.getHeader(ContactHeader.NAME)
        const host = contactHeader.getAddress().getHost()
        const port = contactHeader.getAddress().getPort()
        const received = viaHeader.getReceived()
        const rPort = viaHeader.getRPort()
        return (!!received && !host.equals(received)) || port != rPort? true : false
    }

    static isRegister(response) {
        const cseq = response.getHeader(CSeqHeader.NAME)
        return cseq.getMethod().equals(Request.REGISTER)? true : false
    }

    static isRegisterOk(response) {
        if(ResponseProcessor.isRegister(response) && ResponseProcessor.isOk(response)) {
            return true
        }
        return false
    }

    static isRegisterNok(response) {
        if(!ResponseProcessor.isOk(response) && ResponseProcessor.isRegister(response)) {
            return true
        }
        return false
    }

    static isInviteWithCT(event) {
        return ResponseProcessor.isInvite(event.getResponse())
          && event.getClientTransaction() != null? true : false
    }

}

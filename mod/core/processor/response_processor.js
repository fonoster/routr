/**
 * @author Pedro Sanders
 * @since v1
 */
const AccountManagerService = require('@routr/core/account_manager_service')
const RegistrarUtils = require('@routr/registrar/utils')

const SipFactory = Java.type('javax.sip.SipFactory')
const FromHeader = Java.type('javax.sip.header.FromHeader')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const ContactHeader = Java.type('javax.sip.header.ContactHeader')
const CSeqHeader = Java.type('javax.sip.header.CSeqHeader')
const ExpiresHeader = Java.type('javax.sip.header.ExpiresHeader')
const Request = Java.type('javax.sip.message.Request')
const Response = Java.type('javax.sip.message.Response')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

class ResponseProcessor {

    constructor(sipProvider, dataAPIs, contextStorage, registry) {
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

        // This response is owned by server
        if (ResponseProcessor.isRegisterOk(response)) {
            return ResponseProcessor.isBehindNat(response) ?
              this.reRegister(event):
              this.storeInRegistry(response)
        } else if (ResponseProcessor.isRegisterNok(response)) {
            this.removeFromRegistry(response)
        }

        ResponseProcessor.mustAuthenticate(response) ? this.handleAuthChallenge(event) :
            this.sendResponse(event)
    }

    storeInRegistry(response) {
        const fromURI = response.getHeader(FromHeader.NAME).getAddress().getURI()
        this.registry.storeRegistry(fromURI, RegistrarUtils.getExpires(response))
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
        const expires = RegistrarUtils.getExpires(response)

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
        } catch (e) {
            LOG.error(e)
        }
    }

    sendResponse(event) {
        const responseOut = event.getResponse().clone()
        responseOut.removeFirst(ViaHeader.NAME)
        if (ResponseProcessor.isTransactional(event) === true) {
            const context = this.contextStorage.findContext(event.getClientTransaction().getBranchId())

            if (context !== null && context.serverTransaction !== null) {
                context.serverTransaction.sendResponse(responseOut)
            } else if (responseOut.getHeader(ViaHeader.NAME) !== null) {
                this.sipProvider.sendResponse(responseOut)
            }
        } else if (responseOut.getHeader(ViaHeader.NAME) !== null) {
            // Could be a BYE due to Record-Route
            // There is no more Via headers; the response was intended for the proxy.
            this.sipProvider.sendResponse(responseOut)
        }

        LOG.debug(responseOut)
    }

    static isOk(response) {
        return response.getStatusCode() === Response.OK
    }

    static mustAuthenticate(response) {
        return response.getStatusCode() === Response.PROXY_AUTHENTICATION_REQUIRED ||
            response.getStatusCode() === Response.UNAUTHORIZED
    }

    static isInviteOrMessage(response) {
        return response.getHeader(CSeqHeader.NAME).getMethod() === Request.INVITE ||
            Request.MESSAGE
    }

    static isInviteOrMessageOk(response) {
        return ResponseProcessor.isInviteOrMessage(response) && ResponseProcessor.isOk(response)
    }

    static isInviteOrMessageNok(response) {
        return ResponseProcessor.isInviteOrMessage(response) && !ResponseProcessor.isOk(response)
    }

    static isStackJob(response) {
        return response.getStatusCode() === Response.TRYING ||
            response.getStatusCode() === Response.REQUEST_TERMINATED ||
            response.getHeader(CSeqHeader.NAME).getMethod() === Request.CANCEL
    }

    static isBehindNat(response) {
        const viaHeader = response.getHeader(ViaHeader.NAME)
        //const contactHeader = response.getHeader(ContactHeader.NAME)
        //const host = contactHeader.getAddress().getHost()
        //const port = contactHeader.getAddress().getPort()
        const host = viaHeader.getHost()
        const port = viaHeader.getPort()
        const received = viaHeader.getReceived()
        const rPort = viaHeader.getRPort()
        print('host=', host, 'received=', received, 'port=', port, 'rPort=', rPort)

        return (!!received && !host.equals(received)) || port !== rPort
    }

    static isRegister(response) {
        const cseq = response.getHeader(CSeqHeader.NAME)
        return cseq.getMethod() === Request.REGISTER
    }

    static isRegisterOk(response) {
        return ResponseProcessor.isRegister(response) && ResponseProcessor.isOk(response)
    }

    static isRegisterNok(response) {
        return !ResponseProcessor.isOk(response) && ResponseProcessor.isRegister(response)
    }

    static isTransactional(event) {
        return ResponseProcessor.isInviteOrMessage(event.getResponse()) && event.getClientTransaction() !== null
    }

}

module.exports = ResponseProcessor

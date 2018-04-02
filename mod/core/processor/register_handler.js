/**
 * @author Pedro Sanders
 * @since v1
 */
import AuthHelper from 'utils/auth_helper'

const SipFactory = Packages.javax.sip.SipFactory
const RouteHeader = Packages.javax.sip.header.RouteHeader
const ToHeader = Packages.javax.sip.header.ToHeader
const ContactHeader = Packages.javax.sip.header.ContactHeader
const ExpiresHeader = Packages.javax.sip.header.ExpiresHeader
const AuthorizationHeader = Packages.javax.sip.header.AuthorizationHeader
const Response = Packages.javax.sip.message.Response
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()

// Should we apply ACL rules here too?
export default class RegisterHandler {

    constructor(locator, registrar) {
        this.locator = locator
        this.registrar = registrar
        this.messageFactory = SipFactory.getInstance().createMessageFactory()
        this.headerFactory = SipFactory.getInstance().createHeaderFactory()
        this.authHelper = new AuthHelper(this.headerFactory)
    }

    getExpHeader(request) {
        let expires
        if (request.getHeader(ExpiresHeader.NAME)) {
            expires =  request.getHeader(ExpiresHeader.NAME).getExpires()
        } else {
            expires = request.getHeader(ContactHeader.NAME).getExpires()
        }
        return this.headerFactory.createExpiresHeader(expires)
    }

    // See: Removing bindings -> https://tools.ietf.org/html/rfc3261#section-10.2.2
    removeEndpoint(request, addressOfRecord, contactURI, hasWildcard) {
        if (hasWildcard) {
            this.locator.removeEndpoint(addressOfRecord, contactURI)
        } else {
            this.locator.removeEndpoint(addressOfRecord)
        }
        const ok = this.messageFactory.createResponse(Response.OK, request)
        ok.addHeader(contactHeader)
        ok.addHeader(expH)
        transaction.sendResponse(ok)
        LOG.debug(ok)
    }

    sendOk(request) {
        const ok = this.messageFactory.createResponse(Response.OK, request)
        ok.addHeader(contactHeader)
        ok.addHeader(expH)
        transaction.sendResponse(ok)
        LOG.debug(ok)
    }

    sendUnauthorized(request) {
        const unauthorized = this.messageFactory.createResponse(Response.UNAUTHORIZED, request)
        unauthorized.addHeader(this.authHelper.generateChallenge(realm))
        transaction.sendResponse(unauthorized)
        LOG.debug(unauthorized)
    }

    register (request, transaction) {
        const contactHeader = request.getHeader(ContactHeader.NAME)
        const contactURI = contactHeader.getAddress().getURI()
        const authHeader = request.getHeader(AuthorizationHeader.NAME)
        const toHeader = request.getHeader(ToHeader.NAME)
        const addressOfRecord = toHeader.getAddress().getURI()
        const realm = addressOfRecord.getHost()

        const expHeader = getExpHeader(request)

        if (expHeader.getExpires() <= 0) {
            removeEndpoint(request, addressOfRecord, contactURI, contactHeader.getAddress().isWildcard())
            return
        }

        if (authHeader == null) {
            sendUnauthorized(request)
            return
        }

        const success = this.registrar.register(request)

        if (success) {
            sendOk(request)
        } else {
            sendUnauthorized(request)
        }

        return
    }
}

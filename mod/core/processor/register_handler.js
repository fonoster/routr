/**
 * @author Pedro Sanders
 * @since v1
 */
const AuthHelper = require('@routr/utils/auth_helper')

const SipFactory = Java.type('javax.sip.SipFactory')
const ToHeader = Java.type('javax.sip.header.ToHeader')
const ContactHeader = Java.type('javax.sip.header.ContactHeader')
const ExpiresHeader = Java.type('javax.sip.header.ExpiresHeader')
const AuthorizationHeader = Java.type('javax.sip.header.AuthorizationHeader')
const Response = Java.type('javax.sip.message.Response')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')

const LOG = LogManager.getLogger()

class RegisterHandler {

    constructor(locator, registrar) {
        this.locator = locator
        this.registrar = registrar
        this.messageFactory = SipFactory.getInstance().createMessageFactory()
        this.headerFactory = SipFactory.getInstance().createHeaderFactory()
        this.authHelper = new AuthHelper(this.headerFactory)
    }

    doProcess (request, transaction) {
        const authHeader = request.getHeader(AuthorizationHeader.NAME)
        const expHeader = this.getExpHeader(request)

        if (expHeader.getExpires() <= 0) {
            return this.removeEndpoint(request, transaction)
        }

        if (authHeader === null) {
            return this.sendUnauthorized(request, transaction)
        }

        this.registrar.register(request)? this.sendOk(request, transaction)
            : this.sendUnauthorized(request, transaction)
    }

    getExpHeader(request) {
        let expires
        if (request.getHeader(ExpiresHeader.NAME)) {
            expires =  request.getHeader(ExpiresHeader.NAME).getExpires()
        } else {
            expires = RegisterHandler.getContactHeader(request).getExpires()
        }
        return this.headerFactory.createExpiresHeader(expires)
    }

    // See: Removing bindings -> https://tools.ietf.org/html/rfc3261#section-10.2.2
    removeEndpoint(request, transaction) {
        const contactHeader = RegisterHandler.getContactHeader(request)
        const contactURI = contactHeader.getAddress().getURI()
        const addressOfRecord = RegisterHandler.getAddressOfRecord(request)

        if (contactHeader.getAddress().isWildcard()) {
            this.locator.removeEndpoint(addressOfRecord, contactURI)
        } else {
            this.locator.removeEndpoint(addressOfRecord)
        }
        this.sendOk(request, transaction)
    }

    sendOk(request, transaction) {
        const ok = this.messageFactory.createResponse(Response.OK, request)
        ok.addHeader(RegisterHandler.getContactHeader(request))
        ok.addHeader(this.getExpHeader(request))
        transaction.sendResponse(ok)
        LOG.debug(ok)
    }

    sendUnauthorized(request, transaction) {
        const realm = RegisterHandler.getAddressOfRecord(request).getHost()
        const unauthorized = this.messageFactory.createResponse(Response.UNAUTHORIZED, request)
        unauthorized.addHeader(this.authHelper.generateChallenge(realm))
        transaction.sendResponse(unauthorized)
        LOG.debug(unauthorized)
    }

    static getContactHeader(request) {
        return request.getHeader(ContactHeader.NAME)
    }

    static getAddressOfRecord(request) {
        const toHeader = request.getHeader(ToHeader.NAME)
        return toHeader.getAddress().getURI()
    }
}

module.exports = RegisterHandler

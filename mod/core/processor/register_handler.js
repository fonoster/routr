/**
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')
const AuthHelper = require('@routr/utils/auth_helper')
const Registrar = require('@routr/registrar/registrar')
const RegistrarUtils = require('@routr/registrar/utils')

const SipFactory = Java.type('javax.sip.SipFactory')
const ToHeader = Java.type('javax.sip.header.ToHeader')
const ContactHeader = Java.type('javax.sip.header.ContactHeader')
const ExpiresHeader = Java.type('javax.sip.header.ExpiresHeader')
const AuthorizationHeader = Java.type('javax.sip.header.AuthorizationHeader')
const Response = Java.type('javax.sip.message.Response')

const messageFactory = SipFactory.getInstance().createMessageFactory()
const headerFactory = SipFactory.getInstance().createHeaderFactory()

class RegisterHandler {

    constructor(dataAPIs) {
        this.registrar = new Registrar(dataAPIs)
    }

    doProcess(serverTransaction) {
        const request = serverTransaction.getRequest()

        if (RegistrarUtils.getExpires(request) <= 0) {
            return this.removeEndpoint(request, serverTransaction)
        }

        this.registrar.register(request) ? RegisterHandler.sendOk(request, serverTransaction) :
            RegisterHandler.sendUnauthorized(request, serverTransaction)
    }

    // See: Removing bindings -> https://tools.ietf.org/html/rfc3261#section-10.2.2
    removeEndpoint(request, transaction) {
        const contactHeader = RegisterHandler.getContactHeader(request)
        const contactURI = contactHeader.getAddress().getURI()
        const addressOfRecord = RegisterHandler.getAddressOfRecord(request)

        postal.publish({
            channel: "locator",
            topic: "endpoint.remove",
            data: {
                addressOfRecord: addressOfRecord,
                contactURI: contactHeader.getAddress().getURI().toString(),
                isWildcard: contactHeader.getAddress().isWildcard()
            }
        })

        RegisterHandler.sendOk(request, transaction)
    }

    static getExpHeader(request) {
        return headerFactory.createExpiresHeader(RegistrarUtils.getExpires(request))
    }

    static sendOk(request, transaction) {
        const ok = messageFactory.createResponse(Response.OK, request)
        ok.addHeader(RegisterHandler.getContactHeader(request))
        ok.addHeader(RegisterHandler.getExpHeader(request))
        transaction.sendResponse(ok)
    }

    static sendUnauthorized(request, transaction) {
        const realm = RegisterHandler.getAddressOfRecord(request).getHost()
        const unauthorized = messageFactory.createResponse(Response.UNAUTHORIZED, request)
        unauthorized.addHeader(AuthHelper.generateChallenge(realm))
        transaction.sendResponse(unauthorized)
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
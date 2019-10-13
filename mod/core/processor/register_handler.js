/**
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')
const AuthHelper = require('@routr/utils/auth_helper')
const Registrar = require('@routr/registrar/registrar')
const RegistrarUtils = require('@routr/registrar/utils')
const {
    sendOk,
    sendUnauthorized,
    getExpires
} = require('@routr/core/processor/processor_utils')

const ToHeader = Java.type('javax.sip.header.ToHeader')
const ContactHeader = Java.type('javax.sip.header.ContactHeader')

class RegisterHandler {

    constructor() {
        this.registrar = new Registrar()
    }

    doProcess(transaction) {
        const request = transaction.getRequest()
        // See: Removing bindings -> https://tools.ietf.org/html/rfc3261#section-10.2.2
        if (getExpires(transaction.getRequest()) <= 0) {            
            const contactHeader = request.getHeader(ContactHeader.NAME)
            const contactURI = contactHeader.getAddress().getURI()
            const toHeader = request.getHeader(ToHeader.NAME)
            const addressOfRecord = toHeader.getAddress().getURI()

            postal.publish({
                channel: "locator",
                topic: "endpoint.remove",
                data: {
                    addressOfRecord: addressOfRecord,
                    contactURI: contactHeader.getAddress().getURI().toString(),
                    isWildcard: contactHeader.getAddress().isWildcard()
                }
            })

            sendOk(transaction, request)
        } else {
            this.registrar.register(request) ?
                sendOk(transaction) :
                sendUnauthorized(transaction)
        }
    }
}

module.exports = RegisterHandler

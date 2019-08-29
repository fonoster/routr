/**
 * @author Pedro Sanders
 * @since v1
 */
const getConfig = require('@routr/core/config_util')
const SipFactory = Java.type('javax.sip.SipFactory')
const ToHeader = Java.type('javax.sip.header.ToHeader')
const addressFactory = SipFactory.getInstance().createAddressFactory()
const messageFactory = SipFactory.getInstance().createMessageFactory()

class ProcessorUtils {

    constructor(request, serverTransaction, messageFactory) {
        this.request = request
        this.st = serverTransaction
    }

    sendResponse(responseType) {
        this.st.sendResponse(messageFactory.createResponse(responseType, this.request))
    }
}

module.exports = ProcessorUtils

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

    /**
     * Discover DIDs sent via a non-standard header
     * The header must be added at config.spec.addressInfo[*]
     * If the such header is present then overwrite the AOR
     */
    static getAOR(request, addressInfo = []) {
        for (const x in addressInfo) {
            let info = addressInfo[x]
            if (request.getHeader(info) !== undefined) {
                let v = request.getHeader(info).getValue()
                if (/sips?:.*@.*/.test(v) || /tel:\d+/.test(v)) {
                    return addressFactory.createURI(v)
                }
                LOG.error('Invalid address: ' + v)
            }
        }

        return getConfig().spec.useToAsAOR ? request.getHeader(ToHeader.NAME).getAddress().getURI() :
            request.getRequestURI()
    }
}

module.exports = ProcessorUtils
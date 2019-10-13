/**
 * @author Pedro Sanders
 * @since v1
 */
const {
    isStackJob,
    isTransactional,
    mustAuthenticate,
    handleAuthChallenge
} = require('@routr/core/processor/processor_utils')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

class ResponseProcessor {

    constructor(sipProvider, dataAPIs, contextStorage) {
        this.sipProvider = sipProvider
        this.contextStorage = contextStorage
    }

    process(event) {
        if (isStackJob(event.getResponse())) {
            return
        }
        // If it is not transactional and athentication is required it means
        // that the REGISTER request was originated by another sipStack
        if (mustAuthenticate(event.getResponse()) && isTransactional(event)) {
            const gwRef = event.getClientTransaction().getRequest()
                .getHeader('X-Gateway-Ref').value
            const r = gatewaysAPI.getGateway(gwRef)
            handleAuthChallenge(his.sipProvider.getSipStack(), event, r.data)
            return
        }
        this.sendResponse(event)
    }

    sendResponse(event) {
        const responseOut = event.getResponse().clone()
        responseOut.removeFirst(ViaHeader.NAME)
        if (isTransactional(event)) {
            const context = this.contextStorage.findContext(event.getClientTransaction().getBranchId())

            if (context && context.serverTransaction) {
                context.serverTransaction.sendResponse(responseOut)
            } else if (responseOut.getHeader(ViaHeader.NAME) !== null) {
                this.sipProvider.sendResponse(responseOut)
            }
        } else if (responseOut.getHeader(ViaHeader.NAME) !== null) {
            // Could be a BYE due to Record-Route
            this.sipProvider.sendResponse(responseOut)
        }

        LOG.debug(responseOut)
    }

}

module.exports = ResponseProcessor

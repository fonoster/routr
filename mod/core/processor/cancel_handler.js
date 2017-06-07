/**
 * @author Pedro Sanders
 * @since v1
 */
const SipFactory = Packages.javax.sip.SipFactory
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()

export default class CancelHandler {

    constructor(sipProvider, contextStorage) {
        this.sipProvider = sipProvider
        this.contextStorage = contextStorage
        this.messageFactory = SipFactory.getInstance().createMessageFactory()
    }

    cancel(request, serverTransaction) {
        const storage = this.contextStorage.getStorage()
        const iterator = storage.iterator()

        while (iterator.hasNext()) {
            const context = iterator.next()
            if (context.serverTransaction && context.serverTransaction.getBranchId()
                .equals(serverTransaction.getBranchId())) {

                let originRequest = context.requestIn
                let originResponse = this.messageFactory.createResponse(Response.REQUEST_TERMINATED, originRequest)
                let cancelResponse = this.messageFactory.createResponse(Response.OK, request)
                let cancelRequest = context.clientTransaction.createCancel()
                let clientTransaction = this.sipProvider.getNewClientTransaction(cancelRequest)

                context.serverTransaction.sendResponse(originResponse)
                serverTransaction.sendResponse(cancelResponse)
                clientTransaction.sendRequest()

                LOG.trace('Original response: ' + originResponse)
                LOG.trace('Cancel response: ' + cancelResponse)
                LOG.trace('Cancel request: ' + cancelRequest)
            }
        }
        LOG.debug(request)
    }
}

/**
 * Stores transaction information in memory. Used by processor.js and registry_helper
 *
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')
const Response = Java.type('javax.sip.message.Response')
const SipFactory = Java.type('javax.sip.SipFactory')
const ArrayList = Java.type('java.util.ArrayList')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()
const messageFactory = SipFactory.getInstance().createMessageFactory()

class ContextStorage {

    constructor(sipProvider) {
        this.storage = new ArrayList()
        this.sipProvider = sipProvider

        postal.subscribe({
        		channel: "processor",
        		topic: "transaction.terminated",
        		callback: (data, envelope) => {
                this.removeContext(data.transactionId)
        		}
      	})

        postal.subscribe({
            channel: "processor",
            topic: "transaction.cancel",
            callback: (data, envelope) => {
                this.cancelTransaction(data.transactionId)
            }
        })
    }

    addContext(context) {
        this.storage.add(context)
    }

    findContext(trans) {
        const iterator = this.storage.iterator()
        while(iterator.hasNext()) {
            const context = iterator.next()

            if (context.clientTransaction === trans ||
                context.serverTransaction === trans) {
                return context
            }
        }
    }

    removeContext(transactionId) {
        const iterator = this.storage.iterator()
        while(iterator.hasNext()) {
            const context = iterator.next()

            if (context.clientTransaction.getBranchId() === transactionId ||
                context.serverTransaction.getBranchId() === transactionId) {
                iterator.remove()
                return true
            }
        }
        LOG.trace("Ongoing Transaction")
    }

    cancelTransaction(transactionId) {
        const storage = this.getStorage()
        const iterator = storage.iterator()

        while (iterator.hasNext()) {
            const context = iterator.next()
            if (context.serverTransaction && context.serverTransaction.getBranchId()
                .equals(transactionId)) {

                const originRequest = context.requestIn
                const originResponse = messageFactory.createResponse(Response.REQUEST_TERMINATED, originRequest)
                // Not sure about originRequest :(
                const cancelResponse = messageFactory.createResponse(Response.OK, originRequest)
                const cancelRequest = context.clientTransaction.createCancel()
                const serverTransaction = context.serverTransaction
                const clientTransaction = this.sipProvider.getNewClientTransaction(cancelRequest)

                context.serverTransaction.sendResponse(originResponse)
                serverTransaction.sendResponse(cancelResponse)
                clientTransaction.sendRequest()

                LOG.trace('Original response: ' + originResponse)
                LOG.trace('Cancel response: ' + cancelResponse)
                LOG.trace('Cancel request: ' + cancelRequest)
            }
        }
    }

    getStorage() {
        return this.storage
    }
}

module.exports = ContextStorage

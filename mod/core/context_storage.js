/**
 * Stores in memory information about sip transactions.
 *
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')
const {
    connectionException
} = require('@routr/utils/exception_helpers')
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
            callback: data => this.removeContext(data.transactionId)
        })

        postal.subscribe({
            channel: "processor",
            topic: "transaction.cancel",
            callback: data => this.cancelTransaction(data.transactionId)
        })
    }

    addContext(context) {
        this.storage.add(context)
        this.printContextStorageSize()
    }

    findContext(transactionId) {
        LOG.debug(`core.ContextStorage.findContext [transactionId: ${transactionId}]`)
        const iterator = this.storage.iterator()
        while (iterator.hasNext()) {
            const context = iterator.next()

            if (context.clientTransaction.getBranchId() === transactionId ||
                context.serverTransaction.getBranchId() === transactionId) {
                return context
            }
        }
        LOG.debug(`core.ContextStorage.findContext [context for transactionId: ${transactionId}] does not exist`)
    }

    removeContext(transactionId) {
        LOG.debug(`core.ContextStorage.removeContext [transactionId: ${transactionId}]`)
        const iterator = this.storage.iterator()
        while (iterator.hasNext()) {
            const context = iterator.next()
            if (context.clientTransaction.getBranchId() === transactionId ||
                context.serverTransaction.getBranchId() === transactionId) {
                iterator.remove()
                LOG.debug(`core.ContextStorage.removeContext [removed transactionId: ${transactionId}]`)
                this.printContextStorageSize()
                return true
            }
        }
        LOG.debug(`core.ContextStorage.removeContext [transaction ongoing / won't remove transactionId: ${transactionId}]`)
        this.printContextStorageSize()
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
                const cancelResponse = messageFactory.createResponse(Response.OK, originRequest)
                // Not sure about originRequest :(
                const cancelRequest = context.clientTransaction.createCancel()
                const serverTransaction = context.serverTransaction

                try {
                    const clientTransaction = this.sipProvider.getNewClientTransaction(cancelRequest)

                    context.serverTransaction.sendResponse(originResponse)
                    serverTransaction.sendResponse(cancelResponse)
                    clientTransaction.sendRequest()
                } catch (e) {
                    connectionException(e, cancelRequest.getRequestURI().getHost())
                }

                LOG.debug(`core.ContextStorage.cancelTransaction [original response is \n ${originResponse}]`)
                LOG.debug(`core.ContextStorage.cancelTransaction [cancel request is \n ${cancelRequest}]`)
                LOG.debug(`core.ContextStorage.cancelTransaction [cancel response is \n ${cancelResponse}]`)

                iterator.remove()
            }
        }
    }

    getStorage() {
        return this.storage
    }

    printContextStorageSize() {
        LOG.debug(`core.ContextStorage [storage size => ${this.getStorage().size()}]`)
    }
}

module.exports = ContextStorage

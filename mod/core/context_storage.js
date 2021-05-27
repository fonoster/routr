/**
 * Stores in memory information about sip transactions.
 *
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')
const { connectionException } = require('@routr/utils/exception_helpers')
const Request = Java.type('javax.sip.message.Request')
const CSeqHeader = Java.type('javax.sip.header.CSeqHeader')
const Response = Java.type('javax.sip.message.Response')
const SipFactory = Java.type('javax.sip.SipFactory')
const ArrayList = Java.type('java.util.ArrayList')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()
const messageFactory = SipFactory.getInstance().createMessageFactory()
const headerFactory = SipFactory.getInstance().createHeaderFactory()

class ContextStorage {
  constructor (sipProvider) {
    this.storage = new ArrayList()
    this.sipProvider = sipProvider

    postal.subscribe({
      channel: 'processor',
      topic: 'transaction.terminated',
      callback: data => this.removeContext(data.transactionId)
    })

    postal.subscribe({
      channel: 'processor',
      topic: 'transaction.cancel',
      callback: data => this.cancelTransaction(data.transaction)
    })
  }

  addContext (context) {
    this.storage.add(context)
    this.printContextStorageSize()
  }

  findContext (transactionId) {
    LOG.debug(
      `core.ContextStorage.findContext [transactionId: ${transactionId}]`
    )
    const iterator = this.storage.iterator()
    while (iterator.hasNext()) {
      const context = iterator.next()

      if (
        context.clientTransaction.getBranchId() === transactionId ||
        context.serverTransaction.getBranchId() === transactionId
      ) {
        return context
      }
    }
    LOG.debug(
      `core.ContextStorage.findContext [context for transactionId: ${transactionId}] does not exist`
    )
  }

  removeContext (transactionId) {
    LOG.debug(
      `core.ContextStorage.removeContext [transactionId: ${transactionId}]`
    )
    const iterator = this.storage.iterator()
    while (iterator.hasNext()) {
      const context = iterator.next()
      if (
        context.clientTransaction.getBranchId() === transactionId ||
        context.serverTransaction.getBranchId() === transactionId
      ) {
        iterator.remove()
        LOG.debug(
          `core.ContextStorage.removeContext [removed transactionId: ${transactionId}]`
        )
        this.printContextStorageSize()
        return true
      }
    }
    LOG.debug(
      `core.ContextStorage.removeContext [transaction ongoing / won't remove transactionId: ${transactionId}]`
    )
    this.printContextStorageSize()
  }

  cancelTransaction (transaction) {
    const storage = this.getStorage()
    const iterator = storage.iterator()

    while (iterator.hasNext()) {
      const context = iterator.next()
      if (
        context.serverTransaction &&
        context.serverTransaction
          .getBranchId()
          .equals(transaction.getBranchId())
      ) {
        try {
          // Let client know we are processing the request
          const cancelResponse = messageFactory.createResponse(
            Response.OK,
            transaction.getRequest()
          )
          transaction.sendResponse(cancelResponse)

          // Send cancel request to destination
          const cseq = context.requestIn
            .getHeader(CSeqHeader.NAME)
            .getSeqNumber()
          const cancelRequest = context.clientTransaction.createCancel()
          cancelRequest.setRequestURI(context.requestOut.getRequestURI())
          const cseqHeader = headerFactory.createCSeqHeader(
            cseq,
            Request.CANCEL
          )
          cancelRequest.setHeader(cseqHeader)
          const clientTransaction = this.sipProvider.getNewClientTransaction(
            cancelRequest
          )

          LOG.debug('Outgoing request ==> \n' + cancelRequest)

          clientTransaction.sendRequest()

          // Sends 487 (Request terminated) back to client
          const terminatedResponse = messageFactory.createResponse(
            Response.REQUEST_TERMINATED,
            context.requestIn
          )
          context.serverTransaction.sendResponse(terminatedResponse)

          LOG.debug(
            `core.ContextStorage.cancelTransaction [cancel response is \n ${cancelResponse}]`
          )
          LOG.debug(
            `core.ContextStorage.cancelTransaction [cancel request is \n ${cancelRequest}]`
          )
          LOG.debug(
            `core.ContextStorage.cancelTransaction [terminatedResponse response is \n ${terminatedResponse}]`
          )
        } catch (e) {
          connectionException(
            e,
            cancelRequest.getRequestURI().getHost(),
            transaction
          )
        }
        iterator.remove()
      }
    }
  }

  getStorage () {
    return this.storage
  }

  printContextStorageSize () {
    LOG.debug(
      `core.ContextStorage [storage size => ${this.getStorage().size()}]`
    )
  }
}

module.exports = ContextStorage

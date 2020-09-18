/**
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')
const RequestProcessor = require('@routr/core/processor/request_processor')
const ResponseProcessor = require('@routr/core/processor/response_processor')
const CallIdHeader = Java.type('javax.sip.header.CallIdHeader')
const FromHeader = Java.type('javax.sip.header.FromHeader')
const SipListener = Java.type('javax.sip.SipListener')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

class Processor {
  constructor (sipProvider, dataAPIs, contextStorage) {
    this.requestProcessor = new RequestProcessor(
      sipProvider,
      dataAPIs,
      contextStorage
    )
    this.responseProcessor = new ResponseProcessor(sipProvider, contextStorage)
  }

  get listener () {
    return new SipListener({
      processRequest: event => {
        try {
          this.requestProcessor.process(event)
        } catch (e) {
          LOG.error(e)
        }
      },

      processResponse: event => {
        try {
          this.responseProcessor.process(event)
        } catch (e) {
          LOG.error(e)
        }
      },

      processTimeout: event => {
        const transactionId = event.isServerTransaction()
          ? event.getServerTransaction().getBranchId()
          : event.getClientTransaction().getBranchId()
        postal.publish({
          channel: 'processor',
          topic: 'transaction.timeout',
          data: {
            transactionId,
            isServerTransaction: event.isServerTransaction()
          }
        })
      },

      processTransactionTerminated: event => {
        const request = event.getServerTransaction().getRequest()
        const callId = request.getHeader(CallIdHeader.NAME).getCallId()
        const fromTag = request.getHeader(FromHeader.NAME).getTag()

        const transactionId = event.isServerTransaction()
          ? event.getServerTransaction().getBranchId()
          : event.getClientTransaction().getBranchId()

        postal.publish({
          channel: 'processor',
          topic: 'transaction.terminated',
          data: {
            transactionId,
            isServerTransaction: event.isServerTransaction(),
            callId,
            fromTag
          }
        })
      },

      processDialogTerminated: event => {
        postal.publish({
          channel: 'processor',
          topic: 'dialog.terminated',
          data: {
            dialogId: event.getDialog().getDialogId()
          }
        })
      }
    })
  }
}

module.exports = Processor

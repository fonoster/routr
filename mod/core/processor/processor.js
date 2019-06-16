/**
 * @author Pedro Sanders
 * @since v1
 */
const RequestProcessor = require('@routr/core/processor/request_processor')
const ResponseProcessor = require('@routr/core/processor/response_processor')

const SipListener = Java.type('javax.sip.SipListener')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')

const LOG = LogManager.getLogger()

class Processor {

    constructor(sipProvider, locator, registry, dataAPIs, contextStorage) {
        this.contextStorage = contextStorage
        this.requestProcessor = new RequestProcessor(sipProvider, locator, dataAPIs, contextStorage)
        this.responseProcessor = new ResponseProcessor(sipProvider, registry, dataAPIs, contextStorage)
    }

    get listener () {
        const requestProcessor = this.requestProcessor
        const responseProcessor = this.responseProcessor

        return new SipListener({
            processRequest: function(event) {
                try {
                    requestProcessor.process(event)
                } catch(e) {
                    LOG.error(e)
                }
            },

            processResponse: function(event) {
                try {
                    responseProcessor.process(event)
                } catch(e) {
                    LOG.error(e)
                }
            },

            processTransactionTerminated: function(event) {
                if (event.isServerTransaction()) {
                    const serverTransaction = event.getServerTransaction()

                    if (!this.contextStorage.removeContext(serverTransaction)) {
                       LOG.trace("Ongoing Transaction")
                    }
                }
            },

            processDialogTerminated: function(event) {
                LOG.trace('Dialog ' + event.getDialog() + ' has been terminated')
            },

            processTimeout: function(event) {
                LOG.trace('Transaction Time out')
            }
        })
    }
}

module.exports = Processor

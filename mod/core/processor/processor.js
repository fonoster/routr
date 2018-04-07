/**
 * @author Pedro Sanders
 * @since v1
 */
import RequestProcessor from 'core/processor/request_processor'
import ResponseProcessor from 'core/processor/response_processor'

const SipListener = Packages.javax.sip.SipListener
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()

export default class Processor {

    constructor(sipProvider, locator, registry, registrar, dataAPIs, contextStorage) {
        this.contextStorage = contextStorage
        this.requestProcessor = new RequestProcessor(sipProvider, locator, registry, registrar, dataAPIs, contextStorage)
        this.responseProcessor = new ResponseProcessor(sipProvider, locator, registry, registrar, dataAPIs, contextStorage)
    }

    get listener () {
        const requestProcessor = this.requestProcessor
        const responseProcessor = this.responseProcessor

        return new SipListener({
            processRequest: function(event) {
                requestProcessor.process(event)
            },

            processResponse: function(event) {
                responseProcessor.process(event)
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

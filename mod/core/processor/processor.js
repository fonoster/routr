/**
 * @author Pedro Sanders
 * @since v1
 */
import RequestProcessor from 'core/processor/request_processor'
import AccountManagerService from 'core/account_manager_service'

const SipFactory = Packages.javax.sip.SipFactory
const SipListener = Packages.javax.sip.SipListener
const ViaHeader = Packages.javax.sip.header.ViaHeader
const CSeqHeader = Packages.javax.sip.header.CSeqHeader
const Request = Packages.javax.sip.message.Request
const Response = Packages.javax.sip.message.Response
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()

export default class Processor {

    constructor(sipProvider, locator, registrar, dataAPIs, contextStorage) {
        this.sipProvider = sipProvider
        this.contextStorage = contextStorage
        this.headerFactory = SipFactory.getInstance().createHeaderFactory()
        this.requestProcessor = new RequestProcessor(sipProvider, locator, registrar, dataAPIs, contextStorage)
        this.accountManagerService = new AccountManagerService(dataAPIs)
    }

    get listener () {
        const sipProvider = this.sipProvider
        const contextStorage = this.contextStorage
        const accountManagerService = this.accountManagerService
        const headerFactory = this.headerFactory
        const requestProcessor = this.requestProcessor

        return new SipListener({
            processRequest: function(event) {
                requestProcessor.process(event)
            },
    
            processResponse: function(event) {
                const responseIn = event.getResponse()
                const cseq = responseIn.getHeader(CSeqHeader.NAME)

                // The stack takes care of this cases
                if (responseIn.getStatusCode() == Response.TRYING ||
                    responseIn.getStatusCode() == Response.REQUEST_TERMINATED ||
                    cseq.getMethod().equals(Request.CANCEL)) return
    
                const clientTransaction = event.getClientTransaction()
    
                // WARNING: This is causing an issue with tcp transport and DIDLogic
                // I believe that DIDLogic does not fully support tcp registration
                if (responseIn.getStatusCode() == Response.PROXY_AUTHENTICATION_REQUIRED ||
                    responseIn.getStatusCode() == Response.UNAUTHORIZED) {
                    let authenticationHelper = sipProvider.getSipStack()
                        .getAuthenticationHelper(accountManagerService.getAccountManager(), headerFactory)
                    let t = authenticationHelper.handleChallenge(responseIn, clientTransaction, event.getSource(), 5)
                    t.sendRequest()
                    LOG.debug(responseIn)
                    return
                }

                // Strip the topmost via header
                const responseOut = responseIn.clone()
                responseOut.removeFirst(ViaHeader.NAME)
    
                if (cseq.getMethod().equals(Request.INVITE) && !!clientTransaction) {
                    // In theory we should be able to obtain the ServerTransaction casting the ApplicationData.
                    // However, I'm unable to find the way to cast this object.
                    //let st = clientTransaction.getApplicationData()'
    
                    const context = contextStorage.findContext(clientTransaction)
    
                    if (!!context && !!context.serverTransaction) context.serverTransaction.sendResponse(responseOut)
    
                } else {
                    // Could be a BYE due to Record-Route
                    // There is no more Via headers; the response was intended for the proxy.
                    if (!!responseOut.getHeader(ViaHeader.NAME)) sipProvider.sendResponse(responseOut)
                }
                LOG.debug(responseOut)
            },
    
            processTransactionTerminated: function(event) {
                if (event.isServerTransaction()) {
                    const serverTransaction = event.getServerTransaction()
    
                    if (!contextStorage.removeContext(serverTransaction)) {
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

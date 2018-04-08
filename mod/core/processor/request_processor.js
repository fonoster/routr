/**
 * @author Pedro Sanders
 * @since v1
 */
import RegisterHandler from 'core/processor/register_handler'
import CancelHandler from 'core/processor/cancel_handler'
import RequestHandler from 'core/processor/request_handler'

export default class RequestProcessor {

    constructor(sipProvider, locator, registrar, dataAPIs, contextStorage) {
        this.sipProvider = sipProvider
        this.contextStorage = contextStorage
        this.locator = locator
        this.dataAPIs = dataAPIs
    }

    process(event) {
        const request = event.getRequest()
        const method = request.getMethod()

        let serverTransaction = event.getServerTransaction()

        if (serverTransaction == null) {
            serverTransaction = this.sipProvider.getNewServerTransaction(request)
        }

        if (method.equals(Request.REGISTER)) {
            // Should we apply ACL rules here too?
            return new RegisterHandler(this.locator, this.registrar).register(request, serverTransaction)
        }

        if(method.equals(Request.CANCEL)) {
            return new CancelHandler(this.sipProvider, this.contextStorage).cancel(request, serverTransaction)
        }

        new RequestHandler().doProcess(request, serverTransaction, this.dataAPIs)
    }
}

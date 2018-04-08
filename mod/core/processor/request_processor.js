/**
 * @author Pedro Sanders
 * @since v1
 */
import RegisterHandler from 'core/processor/register_handler'
import CancelHandler from 'core/processor/cancel_handler'
import RequestHandler from 'core/processor/request_handler'

const Request = Packages.javax.sip.message.Request

export default class RequestProcessor {

    constructor(sipProvider, locator, registrar, dataAPIs, contextStorage) {
        this.sipProvider = sipProvider
        this.contextStorage = contextStorage
        this.locator = locator
        this.registrar = registrar
        this.dataAPIs = dataAPIs
    }

    process(event) {
        const request = event.getRequest()
        const method = request.getMethod()

        let serverTransaction = event.getServerTransaction()

        if (serverTransaction == null) {
            serverTransaction = this.sipProvider.getNewServerTransaction(request)
        }

        switch (method) {
            case Request.REGISTER:
              new RegisterHandler(this.locator, this.registrar).doProcess(request, serverTransaction)
              break
            case Request.CANCEL:
              new CancelHandler(this.sipProvider, this.contextStorage).doProcess(request, serverTransaction)
              break
            default:
              new RequestHandler(this.locator, this.sipProvider, this.dataAPIs, this.contextStorage)
                .doProcess(request, serverTransaction)
        }
    }
}

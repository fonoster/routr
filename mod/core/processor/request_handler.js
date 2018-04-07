/**
 * @author Pedro Sanders
 * @since v1
 */
export default class RequestHandler {

    constructor() {
    }

    doProcess(request, serverTransaction) {
        const response = this.locator.findEndpoint(ProcessorUtils.getAOR(request))
    }
}

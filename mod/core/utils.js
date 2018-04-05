/**
 * @author Pedro Sanders
 * @since v1
 */
import { Status } from 'core/status'

export default class CoreUtils {

    static buildErrResponse(e) {
        return buildResponse(Status.INTERNAL_SERVER_ERROR, null, e)
    }

    static buildResponse(status, result, e) {
        const response = {
            status: status,
            message: Status.message[status].value
        }

        if (result) {
            response.result = result
        }

        if(e) {
            response.result = e.getMessage()
        }

        return response
    }
}

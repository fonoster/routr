/**
 * @author Pedro Sanders
 * @since v1
 */
import { Status } from 'core/status'
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()

export default class CoreUtils {

    static buildErrResponse(e) {
        LOG.error(e)
        return CoreUtils.buildResponse(Status.INTERNAL_SERVER_ERROR, [], e)
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
            response.result = e.toString()
        }

        return response
    }
}

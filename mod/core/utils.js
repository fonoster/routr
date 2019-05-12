/**
 * @author Pedro Sanders
 * @since v1
 */
const { Status } = require('@routr/core/status')

const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

class CoreUtils {

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

module.exports = CoreUtils

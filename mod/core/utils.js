/**
 * @author Pedro Sanders
 * @since v1
 */
const {
    Status
} = require('@routr/core/status')

const JedisConnectionException = Java.type('redis.clients.jedis.exceptions.JedisConnectionException')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

class CoreUtils {

    static buildErrResponse(e) {
        if (e instanceof JedisConnectionException) {
            LOG.error('Unable to connect with Redis')
        } else {
            LOG.error(e)
        }
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

        if (e) {
            response.result = e.toString()
        }

        return response
    }
}

module.exports = CoreUtils
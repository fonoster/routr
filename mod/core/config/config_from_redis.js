/**
 * @author Pedro Sanders
 * @since v1
 */
const System = Java.type('java.lang.System')
const ConfigAPI = require('@routr/data_api/config_api')
const RedisDataSource = require('@routr/data_api/redis_datasource')
const DSUtils = require('@routr/data_api/utils')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const Thread = Java.type('java.lang.Thread')
const LOG = LogManager.getLogger(Java.type('io.routr.core.Launcher'))
const { Status } = require('@routr/core/status')
const defaultRedisParameters =
  'host=localhost,port=6379,max_retry=-1,retry_interval=2'

module.exports.getConfig = configFromFile => {
  const parameters = DSUtils.getParameters(
    configFromFile,
    defaultRedisParameters,
    ['host', 'port', 'secret', 'max_retry', 'retry_interval']
  )
  const retryInterval = parseInt(parameters.retry_interval)
  let maxRetry = parseInt(parameters.max_retry)

  while (true) {
    const configApi = new ConfigAPI(new RedisDataSource(configFromFile))
    const response = configApi.getConfig()
    if (response.status === Status.OK || response.status === Status.NOT_FOUND) {
      // The preferences found in database takes priority over the file config
      return response.data || {}
    } else {
      LOG.error(
        'Unable to connect to redis. Please verify your network connection and authentication settings'
      )
      if (maxRetry === 0) System.exit(1)
      Thread.sleep(retryInterval * 1000)
      maxRetry -= 1
    }
  }
}

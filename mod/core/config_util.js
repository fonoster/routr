/**
 * @author Pedro Sanders
 * @since v1
 */
const merge = require('deepmerge')
const defaults = require('@routr/core/config/config_defaults')(
  new Date().getTime()
)
const { getSalt } = require('@routr/core/config/salt')
const getConfigFromRedis = require('@routr/core/config/config_from_redis')
  .getConfig
const getConfigFromFile = require('@routr/core/config/config_from_file')
  .getConfig
const getConfigFromEnv = require('@routr/core/config/config_from_env').getConfig
const overwriteMerge = (destinationArray, sourceArray, options) => sourceArray
const isRedisDS = config =>
  config.spec &&
  config.spec.dataSource &&
  config.spec.dataSource.provider === 'redis_data_provider'

/**
 * The order of presedence for the merged configuration is:
 *
 * Environment -> File -> Persited Config -> Defaults
 *
 * The function
 * will overwrite in full any array parameter using "overwriteMerge".
 */
module.exports = () => {
  let mergedConfig = merge(getConfigFromFile(), getConfigFromEnv(), {
    arrayMerge: overwriteMerge
  })

  if (isRedisDS(mergedConfig)) {
    mergedConfig = merge(
      // Redis Data Source needs some basic info
      getConfigFromRedis(mergedConfig),
      mergedConfig,
      { arrayMerge: overwriteMerge }
    )
  }

  mergedConfig.salt = getSalt()

  return merge(defaults, mergedConfig, { arrayMerge: overwriteMerge })
}

/**
 * @author Pedro Sanders
 * @since v1
 */
const defaults = require('@routr/core/config/config_defaults')()
const merge = require('deepmerge')
const { getSalt } = require('@routr/core/config/salt')
const getConfigFromRedis = require('@routr/core/config/config_from_redis')
  .getConfig
const getConfigFromFile = require('@routr/core/config/config_from_file')
  .getConfig

/**
 * Parameters in config.yml will overwrite what’s on the database (if redis is use).
 * The remaining parameters will be taken from the “defaults” object. The function
 * will overwrite in full any array parameter using "overwriteMerge".
 */
const loadConfig = upSince => {
  const overwriteMerge = (destinationArray, sourceArray, options) => sourceArray
  let config = { salt: getSalt() }
  const configFromFile = getConfigFromFile()

  if (
    configFromFile.spec &&
    configFromFile.spec.dataSource &&
    configFromFile.spec.dataSource.provider === 'redis_data_provider'
  ) {
    config = merge(
      // Redis Data Source needs some basic info
      getConfigFromRedis(configFromFile),
      configFromFile,
      { arrayMerge: overwriteMerge }
    )
  }

  return merge(defaults, config, { arrayMerge: overwriteMerge })
}

const upSince = new Date().getTime()

module.exports = () => loadConfig(upSince)
module.exports.loadConfig = loadConfig
module.exports.reloadConfig = () => loadConfig(upSince)

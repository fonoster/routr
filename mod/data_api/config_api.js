/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const DSUtils = require('@routr/data_api/utils')
const { Status } = require('@routr/core/status')
const configSchemPath = 'etc/schemas/config_schema.json'

class ConfigAPI {
  constructor (dataSource) {
    this.ds = dataSource
  }

  setConfig (config) {
    try {
      const errors = DSUtils.validateObj(configSchemPath, config)
      if (errors.length > 0) {
        return CoreUtils.buildResponse(
          Status.UNPROCESSABLE_ENTITY,
          errors.join()
        )
      }
      return this.ds.set('config', config)
    } catch (e) {
      return CoreUtils.buildResponse(Status.BAD_REQUEST, e.toString())
    }
  }

  getConfig () {
    return this.ds.get('config')
  }
}

module.exports = ConfigAPI

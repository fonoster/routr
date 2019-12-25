/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const DSUtils = require('@routr/data_api/utils')
const {
    Status
} = require('@routr/core/status')

class ConfigAPI {

    constructor(dataSource) {
        this.ds = dataSource
    }

    setConfig(config) {
        try {
          return this.ds.set('config', config)
        } catch(e) {
            console.log(e)
        }
    }

    getConfig() {
        return this.ds.get('config')
    }
}

module.exports = ConfigAPI

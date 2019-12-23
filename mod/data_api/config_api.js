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
        return this.ds.set('config', config)
    }

    getConfig() {
        return this.ds.get('config')
    }
}

module.exports = ConfigAPI

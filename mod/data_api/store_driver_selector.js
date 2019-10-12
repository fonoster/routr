const RedisStore = require('@routr/data_api/redis_store')
const FilesStore = require('@routr/data_api/files_store')
const config = require('@routr/core/config_util')()

class StoreDriverSelector {

    constructor() {
        if (config.spec.dataSource.provider === 'redis_data_provider') {
            this.storeDriver = new RedisStore()
        } else {
            console.log('DBG001')
            this.storeDriver = new FilesStore()
        }
    }

    getDriver() {
        return this.storeDriver
    }

}

const instace = new StoreDriverSelector()
Object.freeze(instace)
module.exports = instace

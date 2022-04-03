/**
 * @author Pedro Sanders
 * @since v1
 */
const RedisStore = require('@routr/data_api/redis_store')
const FilesStore = require('@routr/data_api/files_store')
const getConfig = require('@routr/core/config_util')

class StoreDriverSelector {
  static getDriver (c) {
    const config = c ? c : getConfig()
    if (config.spec.dataSource.provider === 'redis_data_provider') {
      this.storeDriver = new RedisStore()
    } else {
      this.storeDriver = new FilesStore()
    }
    return this.storeDriver
  }
}

module.exports = StoreDriverSelector

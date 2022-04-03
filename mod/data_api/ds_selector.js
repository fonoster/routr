const FilesDataSource = require('@routr/data_api/files_datasource')
const RedisDataSource = require('@routr/data_api/redis_datasource')
const getConfig = require('@routr/core/config_util')

class DSSelector {
  static getDS (c) {
    const config = c ? c : getConfig()
    if (config.spec.dataSource.provider === 'files_data_provider') {
      this.dataSource = new FilesDataSource(config)
    } else if (config.spec.dataSource.provider === 'redis_data_provider') {
      this.dataSource = new RedisDataSource(config)
    } else {
      throw 'Invalid datasource provider'
    }

    return this.dataSource
  }
}

module.exports = DSSelector

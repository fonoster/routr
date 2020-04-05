/**
 * @author Pedro Sanders
 * @since v1
 */
const DSUtils = require('@routr/data_api/utils')
const FilesUtil = require('@routr/utils/files_util')
const System = Java.type('java.lang.System')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

function getConfig () {
  let config
  try {
    if (System.getenv('ROUTR_CONFIG_FILE') !== null) {
      config = DSUtils.convertToJson(
        FilesUtil.readFile(System.getenv('ROUTR_CONFIG_FILE'))
      )
    } else {
      config = DSUtils.convertToJson(FilesUtil.readFile('config/config.yml'))
    }
    return config
  } catch (e) {
    LOG.error('Unable to open configuration file')
    System.exit(1)
  }
}

module.exports = {
  getConfig
}

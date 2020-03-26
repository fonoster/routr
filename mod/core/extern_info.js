/**
 * @author Pedro Sanders
 * @since v1
 */
const LogManager =
Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()
const ANSI_GREEN = '\u001B[32m'
const ANSI_YELLOW = '\u001B[33m'
const ANSI_RESET =       '\u001B[0m'

module.exports = config => {
  if (config.spec.externAddr) {
    LOG.info(
      `ExternAddr is ${ANSI_GREEN}${config.spec.externAddr}${ANSI_RESET}`
    )

    if (config.spec.localnets) {
      LOG.info(
        `Localnets is ${ANSI_GREEN}${config.spec.localnets.join(
          ','
        )}${ANSI_RESET}`
      )
    }
  }
}

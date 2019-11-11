/**
 * @author Pedro Sanders
 * @since v1
 */
module.exports = config => {
    if (config.spec.externAddr) {
        LOG.info(`ExternAddr is ${ANSI_GREEN}${config.spec.externAddr}${ANSI_RESET}`)

        if (config.spec.localnets) {
            LOG.info(`Localnets is ${ANSI_GREEN}${config.spec.localnets.join(',')}${ANSI_RESET}`)
        }
    }
}

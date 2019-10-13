/**
 * @author Pedro Sanders
 * @since v1
 *
 * Sip provider for Registry module
 */
const isRegistered = (regs, gwRef) => regs
    .filter(r => JSON.parse(r).gwRef === gwRef).length > 0
const isStaticMode = gw => gw.spec.credentials === undefined
const unregistered = (regs, gateways) => gateways && regs ? gateways
    .filter(gw => !isStaticMode(gw) && !isRegistered(regs, gw.ref)) : []
const isExpired = (reg, gwRef) => {
    if (reg === null) {
        return true
    }
    const elapsed = (Date.now() - reg.registeredOn) / 1000
    return reg.expires - elapsed <= 0
}

module.exports.isRegistered = isRegistered
module.exports.isExpired = isExpired
module.exports.isStaticMode = isStaticMode
module.exports.unregistered = unregistered

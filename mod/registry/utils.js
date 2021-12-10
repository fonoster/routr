/**
 * @author Pedro Sanders
 * @since v1
 *
 * Sip provider for Registry module
 */
const isRegistered = (regs, gwRef) =>
  regs.filter(r => JSON.parse(r).gwRef === gwRef).length > 0
const isStaticMode = gw => gw.spec.credentials === undefined
const unregistered = (regs, gateways, failRegs = []) =>
  gateways && regs
    ? gateways.filter(
        gw =>
          !isStaticMode(gw) &&
          !isRegistered(regs, gw.metadata.ref) &&
          // Ignore because this GW failed to register
          !failRegs.includes(gw.metadata.ref)
      )
    : []
const isExpired = reg => {
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

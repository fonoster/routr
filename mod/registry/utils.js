/**
 * @author Pedro Sanders
 * @since v1
 *
 * Sip provider for Registry module
 */
const isRegistered = (regs, gwRef) =>
  regs.filter(r => JSON.parse(r).gwRef === gwRef).length > 0

// Q. Is there a situation were we want to send register without authentication?
const isStaticMode = gw =>
  gw.spec.credentials === undefined || gw.spec.sendRegister != true

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
  // The registry process happens every 30 seconds, so we substract 45 to be sure it is expired
  return reg.expires - elapsed - 45 <= 0
}

module.exports.isRegistered = isRegistered
module.exports.isExpired = isExpired
module.exports.isStaticMode = isStaticMode
module.exports.unregistered = unregistered

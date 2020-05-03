/**
 * @author Pedro Sanders
 * @since v1
 *
 * Miscellaneous utilities
 */
const MissingTransportError = require('@routr/core/missing_transport_error')
const buildAddr = (h, p) => `${h}${p ? ':' + p : ''}`
const fixPort = port => (port === -1 ? 5060 : port)
const equalsIgnoreCase = (a, b) => a.toLowerCase() === b.toLowerCase()
const protocolTransport = (config, proto) => {
  try {
    const transport = config.spec.transport.filter(
      trans => trans.protocol === proto
    )[0]
    if (!transport.bindAddr) transport.bindAddr = config.spec.bindAddr
    return transport
  } catch (e) {
    throw new MissingTransportError(proto)
  }
}
// Returns the address for the neareast interface to a targeted host
const nearestInterface = (h, p, h1, p1) => {
  const host = h1 ? h1 : h
  const port = p1 ? p1 : p
  return {
    host,
    port
  }
}

module.exports.buildAddr = buildAddr
module.exports.fixPort = fixPort
module.exports.protocolTransport = protocolTransport
module.exports.nearestInterface = nearestInterface
module.exports.equalsIgnoreCase = equalsIgnoreCase

/**
 * @author Pedro Sanders
 * @since v1
 */
const {
  subnet,
  isValidIp,
  cidrInfo,
  isValidIpv4,
  isValidIpv6,
  subnetInfo
} = require('ip-utils')
const formatNet = net => {
  if (net.split('/').length === 1) {
    if (isValidIpv4(net)) return `${net}/32`
    if (isValidIpv6(net)) return `${net}/128`
    throw 'Invalid address!. Must be a valid Ipv4 or Ipv6.'
  }
  const p1 = net.split('/')[0]
  const p2 = net.split('/')[1]
  return isValidIpv4(p2)
    ? `${p1}/${subnetInfo(p1, p2).cidrMask}`
    : `${p1}/${p2}`
}
const hasIp = (net, addr) => subnet(formatNet(net)).contains(addr)
const addressCount = net => cidrInfo(formatNet(net)).inclusiveNumberHosts
const isLocalnet = (nets, addr) =>
  nets && nets.length > 0 && nets.filter(net => hasIp(net, addr)).length > 0

module.exports.addressCount = addressCount
module.exports.isValidIp = isValidIp
module.exports.hasIp = hasIp
module.exports.isLocalnet = isLocalnet

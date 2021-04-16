const LocatorUtils = require('@routr/location/utils')
const { isLocalnet } = require('@routr/core/ip_util')
const { equalsIgnoreCase, fixPort } = require('@routr/utils/misc_utils')
const config = require('@routr/core/config_util')()
const { RoutingType } = require('@routr/core/routing_type')

const Request = Java.type('javax.sip.message.Request')
const ContactHeader = Java.type('javax.sip.header.ContactHeader')
const RouteHeader = Java.type('javax.sip.header.RouteHeader')
const CSeqHeader = Java.type('javax.sip.header.CSeqHeader')
const ToHeader = Java.type('javax.sip.header.ToHeader')
const FromHeader = Java.type('javax.sip.header.FromHeader')
const MaxForwardsHeader = Java.type('javax.sip.header.MaxForwardsHeader')
const SipFactory = Java.type('javax.sip.SipFactory')
const headerFactory = SipFactory.getInstance().createHeaderFactory()
const addressFactory = SipFactory.getInstance().createAddressFactory()
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

const isExternalDevice = r =>
  r && (!r.sentByAddress || r.sentByAddress.endsWith('.invalid'))
// Deprecated
const isWebRTCClient = isExternalDevice
const isPublicAddress = h => !isLocalnet(config.spec.localnets, h)
const needsExternAddress = (route, host) =>
  isExternalDevice(route) || isPublicAddress(host)

// Deprecated
const addrHost = a => (a.contains(':') ? a.split(':')[0] : a)
// Deprecated
const addrPort = a => (a.contains(':') ? parseInt(a.split(':')[1]) : 5060)
// Deprecated
const ownedAddresss = originInterfaceAddr =>
  config.spec.externAddr
    ? [
        originInterfaceAddr,
        {
          host: addrHost(config.spec.externAddr),
          port: addrPort(config.spec.externAddr)
        }
      ]
    : [originInterfaceAddr]
const getEdgeAddr = (endpointHost, interfaceHost, route) => {
  const externAddr = config.spec.externAddr
  return externAddr && needsExternAddress(route, endpointHost)
    ? externAddr
    : interfaceHost
}
const getToUser = request => {
  const toHeader = request.getHeader(ToHeader.NAME)
  return toHeader
    .getAddress()
    .getURI()
    .getUser()
}
const getUser = request => request.getRequestURI().getUser()
const configureMaxForwards = request => {
  const requestOut = request.clone()
  const maxForwardsHeader = requestOut.getHeader(MaxForwardsHeader.NAME)
  maxForwardsHeader.decrementMaxForwards()
  return requestOut
}
const configureContact = request => {
  const requestOut = request.clone()
  const contactHeader = requestOut.getHeader(ContactHeader.NAME)
  if (
    contactHeader &&
    config.spec.externAddr &&
    isPublicAddress(requestOut.getRequestURI().getHost())
  ) {
    contactHeader
      .getAddress()
      .getURI()
      .setHost(config.spec.externAddr)
    requestOut.setHeader(contactHeader)
  }
  return requestOut
}
const configureCSeq = request => {
  const requestOut = request.clone()
  // Lower the cseq to match the original request
  if (requestOut.getMethod().equals(Request.INVITE)) {
    const cseq = requestOut.getHeader(CSeqHeader.NAME).getSeqNumber() - 1
    requestOut.getHeader(CSeqHeader.NAME).setSeqNumber(cseq)
  }
  return requestOut
}
const configureProxyAuthorization = request => {
  const requestOut = request.clone()
  requestOut.removeHeader('Proxy-Authorization')
  return requestOut
}
const configureRoute = (request, originInterfaceAddr, targetInterfaceAddr) => {
  const requestOut = request.clone()
  const routeHeader = request.getHeader(RouteHeader.NAME)
  if (routeHeader) {
    // 52.174.241.181
    const host = routeHeader
      .getAddress()
      .getURI()
      .getHost()
    // 5060
    const port = fixPort(
      routeHeader
        .getAddress()
        .getURI()
        .getPort()
    )

    LOG.debug(
      `core.processor.RequestUtils.configureRoute [host = ${host}, port=${port}]`
    )

    const c = [originInterfaceAddr, targetInterfaceAddr].filter(
      a => a.host === host && a.port === port
    ).length

    LOG.debug(
      `core.processor.RequestUtils.configureRoute [owns address? = ${c > 0}]`
    )

    if (c > 0) {
      requestOut.removeFirst(RouteHeader.NAME)
      requestOut.removeFirst(RouteHeader.NAME)
    }
  }
  return requestOut
}
const configureVia = (request, interfaceAddr, transport) => {
  const viaHeader = headerFactory.createViaHeader(
    interfaceAddr.host,
    interfaceAddr.port,
    transport,
    null
  )
  viaHeader.setRPort()
  const requestOut = request.clone()
  requestOut.addFirst(viaHeader)
  return requestOut
}
const buildRecordRoute = addr => {
  const sipURI = addressFactory.createSipURI(null, addr.host)
  sipURI.setPort(addr.port)
  sipURI.setTransportParam(addr.transport)
  sipURI.setLrParam()
  const address = addressFactory.createAddress(sipURI)
  return headerFactory.createRecordRouteHeader(address)
}
// rfc5658
const configureRecordRoute = (
  request,
  originInterfaceAddr,
  targetInterfaceAddr
) => {
  if (config.spec.recordRoute) {
    const requestOut = request.clone()
    requestOut.addHeader(buildRecordRoute(originInterfaceAddr))

    LOG.debug(
      `core.processor.RequestUtils.configureRecordRoute [Adding originInterfaceAddr -> ${JSON.stringify(
        originInterfaceAddr
      )}]`
    )

    // Add the targetInterfaceAddr only if it is different to the
    // originInterfaceAddr
    if (
      originInterfaceAddr.host !== targetInterfaceAddr.host ||
      originInterfaceAddr.port !== targetInterfaceAddr.port ||
      originInterfaceAddr.transport !== targetInterfaceAddr.transport
    ) {
      LOG.debug(
        `core.processor.RequestUtils.configureRecordRoute [Adding targetInterfaceAddr -> ${JSON.stringify(
          targetInterfaceAddr
        )}]`
      )
      requestOut.addHeader(buildRecordRoute(targetInterfaceAddr))
    }
    return requestOut
  }
  return request
}
const configureRequestURI = (request, routeInfo, route) => {
  const requestOut = request.clone()
  let uri

  if (
    routeInfo &&
    (routeInfo.getRoutingType() === RoutingType.DOMAIN_EGRESS_ROUTING ||
      routeInfo.getRoutingType() === RoutingType.PEER_EGRESS_ROUTING)
  ) {
    uri = `sip:${getToUser(request)}@${route.gwHost}`
    //} else if (isWebRTCClient(route)) {
    //  uri = `sip:${getUser(request)}@${route.received}:${route.rport}`
    //  LOG.debug('XXXXX uri=' + uri)
    //
  } else {
    uri = route.contactURI
  }

  requestOut.setRequestURI(LocatorUtils.aorAsObj(uri))
  return requestOut
}
const configurePrivacy = (request, routeInfo) => {
  const requestOut = request.clone()
  requestOut.removeHeader('Privacy')
  const callee = routeInfo.getCallee()
  if (callee && equalsIgnoreCase(callee.kind, 'agent')) {
    let privacyHeader

    if (
      callee.spec.privacy &&
      equalsIgnoreCase(callee.spec.privacy, 'private')
    ) {
      const originFromHeader = requestOut.getHeader(FromHeader.NAME)
      const fromHeaderAddrs = addressFactory.createAddress(
        `"Anonymous" <sip:anonymous@anonymous.invalid>`
      )
      const fromHeader = headerFactory.createHeader(
        'From',
        fromHeaderAddrs.toString()
      )
      fromHeader.setTag(originFromHeader.getTag())
      requestOut.setHeader(fromHeader)
      privacyHeader = headerFactory.createHeader('Privacy', 'id')
    } else {
      privacyHeader = headerFactory.createHeader('Privacy', 'none')
    }

    requestOut.addHeader(privacyHeader)
  }
  return requestOut
}
const configureIdentity = (request, route) => {
  const requestOut = request.clone()
  if (route.thruGw) {
    const remotePartyIdHeader = headerFactory.createHeader(
      'Remote-Party-ID',
      `<sip:${route.number}@${route.gwHost}>;screen=yes;party=calling`
    )
    const dp = requestOut
      .getHeader(FromHeader.NAME)
      .getAddress()
      .getDisplayName()
    const displayName = dp ? `"${dp}" ` : ''
    const pAssertedIdentity = headerFactory.createHeader(
      'P-Asserted-Identity',
      `${displayName}<sip:${route.number}@${route.gwHost}>`
    )
    requestOut.setHeader(remotePartyIdHeader)
    requestOut.setHeader(pAssertedIdentity)
  }
  return requestOut
}
const configureXHeaders = (request, route) => {
  const requestOut = request.clone()
  if (route.thruGw) {
    const gwRefHeader = headerFactory.createHeader('X-Gateway-Ref', route.gwRef)
    requestOut.setHeader(gwRefHeader)
  }
  return requestOut
}
const isInDialog = request =>
  request.getHeader(ToHeader.NAME).getTag() !== null &&
  request.getHeader(FromHeader.NAME).getTag() !== null

module.exports.getEdgeAddr = getEdgeAddr
module.exports.configureRoute = configureRoute
module.exports.configureVia = configureVia
module.exports.configureProxyAuthorization = configureProxyAuthorization
module.exports.configureRequestURI = configureRequestURI
module.exports.configureMaxForwards = configureMaxForwards
module.exports.configureContact = configureContact
module.exports.configurePrivacy = configurePrivacy
module.exports.configureRecordRoute = configureRecordRoute
module.exports.configureIdentity = configureIdentity
module.exports.configureXHeaders = configureXHeaders
module.exports.configureCSeq = configureCSeq
module.exports.isInDialog = isInDialog

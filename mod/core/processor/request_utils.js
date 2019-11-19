const LocatorUtils = require('@routr/location/utils')
const {
  isLocalnet,
} = require('@routr/core/ip_util')
const {
    equalsIgnoreCase,
    fixPort
} = require('@routr/utils/misc_utils')
const config = require('@routr/core/config_util')()
const {
    RoutingType
} = require('@routr/core/routing_type')

const Request = Java.type('javax.sip.message.Request')
const ContactHeader = Java.type('javax.sip.header.ContactHeader')
const RouteHeader = Java.type('javax.sip.header.RouteHeader')
const CSeqHeader = Java.type('javax.sip.header.CSeqHeader')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const ToHeader = Java.type('javax.sip.header.ToHeader')
const FromHeader = Java.type('javax.sip.header.FromHeader')
const MaxForwardsHeader = Java.type('javax.sip.header.MaxForwardsHeader')
const SipFactory = Java.type('javax.sip.SipFactory')
const headerFactory = SipFactory.getInstance().createHeaderFactory()
const addressFactory = SipFactory.getInstance().createAddressFactory()

const isExternalDevice = r => !r.sentByAddress || r.sentByAddress.endsWith('.invalid')
const hasPublicAddress = r => {
    const contactHeader = r.getHeader(ContactHeader.NAME)
    if (!contactHeader) return false
    const callerHost = contactHeader.getAddress().getURI().getHost()
    return !isLocalnet(config.spec.localnets, callerHost)
}
const needsExternAddress = (req, rte) => isExternalDevice(rte) || hasPublicAddress(req)
const addrHost = a => a.contains(':') ? a.split(':')[0] : a
const addrPort = (a, p) => a.contains(':') ? a.split(':')[1] : p.port
const getAdvertizedAddr = (request, route, localAddr, externAddr) =>
    externAddr && needsExternAddress(request, route)
        ? { host: addrHost(externAddr), port: addrPort(externAddr, localAddr) }
        : { host: localAddr.host, port: localAddr.port }
const configureMaxForwards = request => {
    const requestOut = request.clone()
    const maxForwardsHeader = requestOut.getHeader(MaxForwardsHeader.NAME)
    maxForwardsHeader.decrementMaxForwards()
    return requestOut
}
const configureContact = (request, route) => {
    const requestOut = request.clone()
    const contactHeader = requestOut.getHeader(ContactHeader.NAME)
    if (contactHeader &&
        config.spec.externAddr &&
        hasPublicAddress(requestOut)) {
        contactHeader.getAddress().getURI().setHost(config.spec.externAddr)
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
const configureRoute = (request, advertisedAddr) => {
    const requestOut = request.clone()
    const routeHeader = request.getHeader(RouteHeader.NAME)
    if (routeHeader) {
        const host = routeHeader.getAddress().getURI().getHost()
        const port = fixPort(routeHeader.getAddress().getURI().getPort())
        if (host.equals(advertisedAddr.host) && port === advertisedAddr.port) {
            requestOut.removeFirst(RouteHeader.NAME)
        }
    }
    return requestOut
}
const configureNextHop = (request, advertisedAddr) => {
    const requestOut = request.clone()
    const transport = requestOut.getHeader(ViaHeader.NAME).getTransport().toLowerCase()
    const viaHeader = headerFactory
        .createViaHeader(advertisedAddr.host, advertisedAddr.port, transport, null)
    viaHeader.setRPort()
    requestOut.addFirst(viaHeader)
    return requestOut
}
const configureRecordRoute = (request, advertisedAddr) => {
    const requestOut = request.clone()
    if (config.spec.recordRoute && request.getMethod().equals(Request.INVITE)) {
        const proxyURI = addressFactory.createSipURI(null, advertisedAddr.host)
        proxyURI.setLrParam()
        proxyURI.setPort(advertisedAddr.port)
        const proxyAddress = addressFactory.createAddress(proxyURI)
        const recordRouteHeader = headerFactory.createRecordRouteHeader(proxyAddress)
        requestOut.addHeader(recordRouteHeader)
    }
    return requestOut
}
const configureRequestURI = (request, routeInfo, route) => {
    const requestOut = request.clone()
    if (routeInfo.getRoutingType() === RoutingType.DOMAIN_EGRESS_ROUTING) {
        const toHeader = requestOut.getHeader(ToHeader.NAME)
        const toUser = toHeader.getAddress().getURI().getUser()
        requestOut.setRequestURI(
          LocatorUtils.aorAsObj(`sip:${toUser}@${route.gwHost}`))
    } else {
        requestOut.setRequestURI(LocatorUtils.aorAsObj(route.contactURI))
    }
    return requestOut
}
const configurePrivacy = (request, routeInfo) => {
    const requestOut = request.clone()
    requestOut.removeHeader('Privacy')
    const callee = routeInfo.getCallee()
    if (callee && equalsIgnoreCase(callee.kind, 'agent')) {
        let factoryHeader

        if (callee.spec.privacy && equalsIgnoreCase(callee.spec.privacy, 'private')) {
            const originFromHeader = requestOut.getHeader(FromHeader.NAME)
            const fromHeaderAddrs = addressFactory.createAddress(`"Anonymous" <sip:anonymous@anonymous.invalid>`)
            const fromHeader = headerFactory.createHeader('From', fromHeaderAddrs.toString())
            fromHeader.setTag(originFromHeader.getTag())
            requestOut.setHeader(fromHeader)
            factoryHeader = headerFactory.createHeader('Privacy', 'id')
        } else {
            factoryHeader = headerFactory.createHeader('Privacy', 'none')
        }

        requestOut.addHeader(factoryHeader)
    }
    return requestOut
}
const configureIdentity = (request, route) => {
    const requestOut = request.clone()
    if (route.thruGw) {
        const remotePartyIdHeader = headerFactory
            .createHeader('Remote-Party-ID', `<sip:${route.number}@${route.gwHost}>;screen=yes;party=calling`)
        const dp = requestOut.getHeader(FromHeader.NAME).getAddress().getDisplayName()
        const displayName = dp ? `"${dp}" ` : ''
        const pAssertedIdentity = headerFactory
            .createHeader('P-Asserted-Identity', `${displayName}<sip:${route.number}@${route.gwHost}>`)
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

module.exports.getAdvertizedAddr = getAdvertizedAddr
module.exports.configureRoute = configureRoute
module.exports.configureNextHop = configureNextHop
module.exports.configureProxyAuthorization = configureProxyAuthorization
module.exports.configureRequestURI = configureRequestURI
module.exports.configureMaxForwards = configureMaxForwards
module.exports.configureContact = configureContact
module.exports.configurePrivacy = configurePrivacy
module.exports.configureRecordRoute = configureRecordRoute
module.exports.configureIdentity = configureIdentity
module.exports.configureXHeaders = configureXHeaders
module.exports.configureCSeq = configureCSeq

/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for core functionalities
 */
const FilesDataSource = require('@routr/data_api/files_datasource')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const PeersAPI = require('@routr/data_api/peers_api')
const DIDsAPI = require('@routr/data_api/dids_api')
const DomainsAPI = require('@routr/data_api/domains_api')
const AgentsAPI = require('@routr/data_api/agents_api')
const RouteInfo = require('@routr/core/processor/route_info')
const getConfig = require('@routr/core/config_util')

const sipFactory = Packages.javax.sip.SipFactory.getInstance()
const messageFactory = sipFactory.createMessageFactory()
const headerFactory = sipFactory.createHeaderFactory()
const addressFactory = sipFactory.createAddressFactory()
const SipUtils = Packages.gov.nist.javax.sip.Utils
const Request = Packages.javax.sip.message.Request
const userAgent = new java.util.ArrayList()
userAgent.add('Test I/O v1.0')

const config = getConfig()
// Forces data source to use its own default parameters...
delete config.spec.dataSource.parameters

const ds = new FilesDataSource(config)

const dataAPIs = {
    AgentsAPI: new AgentsAPI(ds),
    DomainsAPI: new DomainsAPI(ds),
    DIDsAPI: new DIDsAPI(ds),
    GatewaysAPI: new GatewaysAPI(ds),
    PeersAPI: new PeersAPI(ds)
}

const testGroup = { name: "Core Processor Module" }

// Tests
testGroup.caller_type = function () {
    const request = getRequest('1001@sip.local', '1002@sip.local')
    const routeInfo = new RouteInfo(request, dataAPIs)
    assertEquals(routeInfo.getCallerType(), 'AGENT')
    assertEquals(routeInfo.getCalleeType(), 'AGENT')
    assertTrue(routeInfo.isSameDomain())
}

// Tests
testGroup.routing_type = function () {
    // Same Domain
    let request = getRequest('1001@sip.local', '1002@sip.local')
    let routeInfo = new RouteInfo(request, dataAPIs)
    assertEquals('INTRA_DOMAIN_ROUTING', routeInfo.getRoutingType())

    // Different domain but both domains exist
    request = getRequest('1001@sip.local', '4001@sip2.local')
    routeInfo = new RouteInfo(request, dataAPIs)
    assertEquals('INTER_DOMAIN_ROUTING', routeInfo.getRoutingType())

    // Call to the PSTN
    request = getRequest('1001@sip.local', '17853178070@sip.local')
    routeInfo = new RouteInfo(request, dataAPIs)
    assertEquals('DOMAIN_EGRESS_ROUTING', routeInfo.getRoutingType())

    // Call from the PSTN
    request = getRequest('17853178070@sip.provider.com', '0000000000@sip.provider.com')
    routeInfo = new RouteInfo(request, dataAPIs)
    assertEquals('DOMAIN_INGRESS_ROUTING', routeInfo.getRoutingType())

    // Peer call
    request = getRequest('0000000000@sip.provider.com', '17853178070@sip.provider.com')
    routeInfo = new RouteInfo(request, dataAPIs)
    assertEquals('PEER_EGRESS_ROUTING', routeInfo.getRoutingType())

    // Peer call
    request = getRequest('ast@astserver', '17853178070@sip.provider.com')
    routeInfo = new RouteInfo(request, dataAPIs)
    assertEquals('PEER_EGRESS_ROUTING', routeInfo.getRoutingType())
}

function getRequest(from, to) {
    const port = 5060
    const host = '192.168.1.2'
    const cseq = 0
    const viaHeaders = []
    const viaHeader = headerFactory.createViaHeader(host, port, 'udp', null)
    // Request RPort for Symmetric Response Routing in accordance with RFC 3581
    viaHeader.setRPort()
    viaHeaders.push(viaHeader)

    const maxForwardsHeader = headerFactory.createMaxForwardsHeader(70)
    const callIdHeader = headerFactory.createCallIdHeader('call0001')
    const cSeqHeader = headerFactory.createCSeqHeader(cseq, Request.REGISTER)
    const fromAddress = addressFactory.createAddress('sip:' + from)
    const fromHeader = headerFactory.createFromHeader(fromAddress, new SipUtils().generateTag())

    const toAddress = addressFactory.createAddress('sip:' + to)
    const toHeader = headerFactory.createToHeader(toAddress, null)
    const expireHeader = headerFactory.createExpiresHeader(3600)
    const contactAddress = addressFactory.createAddress('sip:' + from  + ':' + port)
    const contactHeader = headerFactory.createContactHeader(contactAddress)
    const userAgentHeader = headerFactory.createUserAgentHeader(userAgent)

    const request = messageFactory.createRequest('INVITE sip:sip.provider.net SIP/2.0\r\n\r\n')
    request.addHeader(viaHeader)
    request.addHeader(maxForwardsHeader)
    request.addHeader(callIdHeader)
    request.addHeader(cSeqHeader)
    request.addHeader(fromHeader)
    request.addHeader(toHeader)
    request.addHeader(contactHeader)
    request.addHeader(userAgentHeader)
    request.addHeader(headerFactory.createAllowHeader('INVITE'))
    request.addHeader(headerFactory.createAllowHeader('ACK'))
    request.addHeader(headerFactory.createAllowHeader('BYE'))
    request.addHeader(headerFactory.createAllowHeader('CANCEL'))
    request.addHeader(headerFactory.createAllowHeader('REGISTER'))
    request.addHeader(headerFactory.createAllowHeader('OPTIONS'))
    request.addHeader(expireHeader)

    return request
}

module.exports.testGroup = testGroup

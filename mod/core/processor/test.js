/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for core functionalities
 */
const getConfig = require('@routr/core/config_util')
const { createRequest } = require('@routr/utils/test_util')
const FilesDataSource = require('@routr/data_api/files_datasource')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const PeersAPI = require('@routr/data_api/peers_api')
const DIDsAPI = require('@routr/data_api/dids_api')
const DomainsAPI = require('@routr/data_api/domains_api')
const AgentsAPI = require('@routr/data_api/agents_api')
const RouteInfo = require('@routr/core/processor/route_info')

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

const testGroup = {
    name: "Core Processor Module"
}

// Tests
testGroup.caller_type = function() {
    const request = createRequest('1001@sip.local', '1002@sip.local')
    const routeInfo = new RouteInfo(request, dataAPIs)
    assertEquals('AGENT', routeInfo.getCallerType())
    assertEquals('AGENT', routeInfo.getCalleeType())
    assertTrue(routeInfo.isSameDomain())
}

// Tests
testGroup.routing_type = function() {
    // Same Domain
    let request = createRequest('1001@sip.local', '1002@sip.local')
    let routeInfo = new RouteInfo(request, dataAPIs)
    assertEquals('INTRA_DOMAIN_ROUTING', routeInfo.getRoutingType())

    // Different domain but both domains exist
    request = createRequest('1001@sip.local', '4001@sip2.local')
    routeInfo = new RouteInfo(request, dataAPIs)
    assertEquals('INTER_DOMAIN_ROUTING', routeInfo.getRoutingType())

    // Call to the PSTN
    request = createRequest('1001@sip.local', '17853178070@sip.local')
    routeInfo = new RouteInfo(request, dataAPIs)
    assertEquals('DOMAIN_EGRESS_ROUTING', routeInfo.getRoutingType())

    // Call from the PSTN
    request = createRequest('17853178070@sip.provider.com', '0000000000@sip.provider.com')
    routeInfo = new RouteInfo(request, dataAPIs)
    assertEquals('DOMAIN_INGRESS_ROUTING', routeInfo.getRoutingType())

    // Peer call
    request = createRequest('0000000000@sip.provider.com', '17853178070@sip.provider.com')
    routeInfo = new RouteInfo(request, dataAPIs)
    assertEquals('PEER_EGRESS_ROUTING', routeInfo.getRoutingType())

    // Peer call
    request = createRequest('ast@astserver', '17853178070@sip.provider.com')
    routeInfo = new RouteInfo(request, dataAPIs)
    assertEquals('PEER_EGRESS_ROUTING', routeInfo.getRoutingType())
}

module.exports.testGroup = testGroup

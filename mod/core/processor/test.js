/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for core functionalities
 */
const assert = require('assert')
const getConfig = require('@routr/core/config_util')
const { createRequest } = require('@routr/utils/test_util')
const FilesDataSource = require('@routr/data_api/files_datasource')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const PeersAPI = require('@routr/data_api/peers_api')
const NumbersAPI = require('@routr/data_api/numbers_api')
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
    NumbersAPI: new NumbersAPI(ds),
    GatewaysAPI: new GatewaysAPI(ds),
    PeersAPI: new PeersAPI(ds)
}

describe('Core Processor Module', () => {

    it('Caller type', function(done) {
        const request = createRequest('1001@sip.local', '1002@sip.local')
        const routeInfo = new RouteInfo(request, dataAPIs)
        assert.equal(routeInfo.getCallerType(), 'AGENT')
        assert.equal(routeInfo.getCalleeType(), 'AGENT')
        assert.ok(routeInfo.isSameDomain())
        done()
    })

    it('Routing type', function(done) {
        // Same Domain
        let request = createRequest('1001@sip.local', '1002@sip.local')
        let routeInfo = new RouteInfo(request, dataAPIs)
        assert.equal(routeInfo.getRoutingType(), 'INTRA_DOMAIN_ROUTING')

        // Different domain but both domains exist
        request = createRequest('1001@sip.local', '4001@sip2.local')
        routeInfo = new RouteInfo(request, dataAPIs)
        assert.equal(routeInfo.getRoutingType(), 'INTER_DOMAIN_ROUTING')

        // Call to the PSTN
        request = createRequest('1001@sip.local', '17853178070@sip.local')
        routeInfo = new RouteInfo(request, dataAPIs)
        assert.equal(routeInfo.getRoutingType(), 'DOMAIN_EGRESS_ROUTING')

        // Call from the PSTN
        request = createRequest('17853178070@sip.provider.com', '0000000000@sip.provider.com')
        routeInfo = new RouteInfo(request, dataAPIs)
        assert.equal(routeInfo.getRoutingType(), 'DOMAIN_INGRESS_ROUTING')

        // Peer call
        request = createRequest('0000000000@sip.provider.com', '17853178070@sip.provider.com')
        routeInfo = new RouteInfo(request, dataAPIs)
        assert.equal(routeInfo.getRoutingType(), 'PEER_EGRESS_ROUTING')

        // Peer call
        request = createRequest('ast@astserver', '17853178070@sip.provider.com')
        routeInfo = new RouteInfo(request, dataAPIs)
        assert.equal(routeInfo.getRoutingType(), 'PEER_EGRESS_ROUTING')
        done()
    })

})

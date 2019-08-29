/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Location Service Module"
 */
const assert = require('assert')
const FilesDataSource = require('@routr/data_api/files_datasource')
const Locator = require('@routr/location/locator')
const LocatorUtils = require('@routr/location/utils')
const AgentsAPI = require('@routr/data_api/agents_api')
const PeersAPI = require('@routr/data_api/peers_api')
const NumbersAPI = require('@routr/data_api/numbers_api')
const DomainsAPI = require('@routr/data_api/domains_api')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const {
    Status
} = require('@routr/core/status')
const getConfig = require('@routr/core/config_util')
const SipFactory = Java.type('javax.sip.SipFactory')
const config = getConfig()
// Forces data source to use its own default parameters...
delete config.spec.dataSource.parameters

const ds = new FilesDataSource(config)
const dataAPIs = {
    PeersAPI: new PeersAPI(ds),
    AgentsAPI: new AgentsAPI(ds),
    DomainsAPI: new DomainsAPI(ds),
    GatewaysAPI: new GatewaysAPI(ds),
    NumbersAPI: new NumbersAPI(ds)
}
const addressFactory = SipFactory.getInstance().createAddressFactory()
const locator = new Locator(dataAPIs)

function buildEndpoint(username, domain, host, expires = 60) {
    const aor = addressFactory.createSipURI(username, domain)
    const contactURI = addressFactory.createSipURI(username, host)
    return {
        aor: LocatorUtils.aorAsString(aor),
        route: {
            isLinkAOR: false,
            thruGw: false,
            sentByAddress: 'localhost',
            sentByPort: 5060,
            received: 'remotehost',
            rport: 5061,
            contactURI: contactURI,
            registeredOn: Date.now(),
            expires: expires,
            nat: false
        }
    }
}

function testFE(aor, thruGw = false) {
    const response = locator.findEndpoint(aor)
    assert.equal(response.status, Status.OK)
    response.result.forEach(route => assert.equal(route.thruGw, thruGw))
}

describe('Location Service Module', () => {

    it('Create sipURI', function(done) {
        const sipUri = LocatorUtils.createSipURI("sip:1001@sip.ocean.com")
        done()
    })

    it('AOR as string', function(done) {
        const sipURI = addressFactory.createSipURI('john', 'sip.ocean.com')
        let aorString = LocatorUtils.aorAsString(sipURI)
        assert.equal('sip:john@sip.ocean.com', aorString)
        // Testing TelURL
        const telURL = addressFactory.createTelURL('tel:8095863314')
        aorString = LocatorUtils.aorAsString(telURL)
        assert.equal('tel:8095863314', aorString)
        // Test text format
        aorString = LocatorUtils.aorAsString('sip:john@sip.ocean.com')
        assert.equal('sip:john@sip.ocean.com', aorString)
        done()
    })

    it('Add/remove local endpoint', function(done) {
        const agentEndpoint = buildEndpoint('1001', 'sip.local', '192.168.1.2:5061')
        locator.addEndpoint(agentEndpoint.aor, agentEndpoint.route)
        let response = locator.findEndpoint(agentEndpoint.aor)
        assert.ok(response.result.length > 0)
        const currentCount = response.result.length
        locator.removeEndpoint(agentEndpoint.aor, agentEndpoint.route.contactURI)
        response = locator.findEndpoint(agentEndpoint.aor)
        assert.notEqual(response.status, Status.OK)
        done()
    })

    it('Find local endpoint', function(done) {
        const agentEndpoint = buildEndpoint('1001', 'sip.local', '192.168.1.2:5061')
        const peerEndpoint = buildEndpoint('ast', '192.168.1.2:5061', '192.168.1.2:5061')
        locator.addEndpoint(agentEndpoint.aor, agentEndpoint.route)
        locator.addEndpoint(peerEndpoint.aor, peerEndpoint.route)
        testFE(agentEndpoint.aor)
        testFE(peerEndpoint.aor)
        locator.removeEndpoint(agentEndpoint.aor, agentEndpoint.route.contactURI)
        done()
    })

    it('Find endpoint for number', function(done) {
        // This is the local aor for the number '0000000000'
        const endpoint = buildEndpoint('1001', 'sip.local', '192.168.1.2:5061')
        locator.addEndpoint(endpoint.aor, endpoint.route)
        testFE(addressFactory.createSipURI('0000000000', 'sip.local'), true)
        locator.removeEndpoint(endpoint.aor, endpoint.route.contactURI)
        done()
    })

    it('Find remote endpoint', function(done) {
        testFE(addressFactory.createSipURI('17853178070', 'sip.local'), true)
        done()
    })

    // Test having more than one route per address of record
    it('Add multi aor', function(done) {
        locator.evictAll()
        const ep1 = buildEndpoint('1001', 'sip.local', '192.168.1.2:5061')
        const ep2 = buildEndpoint('1001', 'sip.local', '192.168.1.3:5061', 32)
        locator.addEndpoint(ep1.aor, ep1.route)
        locator.addEndpoint(ep2.aor, ep2.route)
        testFE(ep1.aor)

        // Attempt to add duplicate
        locator.addEndpoint(ep1.aor, ep1.route)
        // Ensure only one entry for contactURI...
        const response = locator.findEndpoint(ep1.aor)
        assert.equal(response.result.length, 2)
        done()
    })

})

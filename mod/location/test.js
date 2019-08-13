/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Location Service Module"
 */
const FilesDataSource = require('@routr/data_api/files_datasource')
const Locator = require('@routr/location/locator')
const LocatorUtils = require('@routr/location/utils')
const DIDsAPI = require('@routr/data_api/dids_api')
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
    DomainsAPI: new DomainsAPI(ds),
    GatewaysAPI: new GatewaysAPI(ds),
    DIDsAPI: new DIDsAPI(ds)
}
const addressFactory = SipFactory.getInstance().createAddressFactory()
const locator = new Locator(dataAPIs)

const testGroup = {
    name: "Location Service Module"
}

// Tests
testGroup.create_sip_uri = function() {
    const sipUri = LocatorUtils.createSipURI("sip:1001@sip.ocean.com")
}

testGroup.aor_as_string = function() {
    const sipURI = addressFactory.createSipURI('john', 'sip.ocean.com')
    let aorString = LocatorUtils.aorAsString(sipURI)
    assertEquals('sip:john@sip.ocean.com', aorString)
    // Testing TelURL
    const telURL = addressFactory.createTelURL('tel:8095863314')
    aorString = LocatorUtils.aorAsString(telURL)
    assertEquals('tel:8095863314', aorString)
    // Test text format
    aorString = LocatorUtils.aorAsString('sip:john@sip.ocean.com')
    assertEquals('sip:john@sip.ocean.com', aorString)
}

testGroup.add_remove_local_endpoint = function() {
    const agentEndpoint = buildEndpoint('1001', 'sip.local', '192.168.1.2:5061')
    locator.addEndpoint(agentEndpoint.aor, agentEndpoint.route)
    let response = locator.findEndpoint(agentEndpoint.aor)
    assertTrue(response.result.length > 0)
    const currentCount = response.result.length
    locator.removeEndpoint(agentEndpoint.aor, agentEndpoint.route.contactURI)
    response = locator.findEndpoint(agentEndpoint.aor)
    // This should actually failed because there is no more local endpoints and gateway routes don't apply
    // Please fix this ASAP!!!
    // assertNotEquals(Status.OK, response.status)
}

testGroup.find_local_endpoint = function() {
    // Add  endpoints
    const agentEndpoint = buildEndpoint('1001', 'sip.local', '192.168.1.2:5061')
    const peerEndpoint = buildEndpoint('ast', '192.168.1.2:5061', '192.168.1.2:5061')
    locator.addEndpoint(agentEndpoint.aor, agentEndpoint.route)
    locator.addEndpoint(peerEndpoint.aor, peerEndpoint.route)
    testFE(agentEndpoint.aor)
    testFE(peerEndpoint.aor)
    locator.removeEndpoint(agentEndpoint.aor, agentEndpoint.route.contactURI)
}

testGroup.find_endpoint_for_did = function() {
    // This is the local aor for the did '0000000000'
    const endpoint = buildEndpoint('1001', 'sip.local', '192.168.1.2:5061')
    locator.addEndpoint(endpoint.aor, endpoint.route)
    testFE(addressFactory.createSipURI('0000000000', 'sip.local'), true)
    locator.removeEndpoint(endpoint.aor, endpoint.route.contactURI)
}

testGroup.find_remote_endpoint = function() {
    testFE(addressFactory.createSipURI('17853178070', 'sip.local'), true)
}

// Test having more than one route per address of record
testGroup.add_multi_aor = function() {
    locator.evictAll()
    const ep1 = buildEndpoint('1001', 'sip.local', '192.168.1.2:5061')
    const ep2 = buildEndpoint('1001', 'sip.local', '192.168.1.3:5061', 32)
    locator.addEndpoint(ep1.aor, ep1.route)
    print('dbg001')
    locator.addEndpoint(ep2.aor, ep2.route)
    print('dbg002')
    testFE(ep1.aor)

    print('dbg003')
    // Attempt to add duplicate
    locator.addEndpoint(ep1.aor, ep1.route)

    print('dbg004')
    // Ensure only one entry for contactURI...
    const response = locator.findEndpoint(ep1.aor)
    print('dbg005')
    assertEquals(2, response.result.length)
}


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
    assertEquals(Status.OK, response.status)
    response.result.forEach(route => assertEquals(thruGw, route.thruGw))
}

module.exports.testGroup = testGroup

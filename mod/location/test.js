/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Location Service Module"
 */

import FilesDataSource from 'data_api/files_datasource'
import Locator from 'location/locator.js'
import LocatorUtils from 'location/utils.js'
import DIDsAPI from 'data_api/dids_api'
import DomainsAPI from 'data_api/domains_api'
import GatewaysAPI from 'data_api/gateways_api'
import { Status } from 'location/status'
import getConfig from 'core/config_util.js'

const config = getConfig()
// Forces data source to use its own default parameters...
delete config.spec.dataSource.parameters

const ds = new FilesDataSource(config)

const dataAPIs = {
    DomainsAPI: new DomainsAPI(ds),
    GatewaysAPI: new GatewaysAPI(ds),
    DIDsAPI: new DIDsAPI(ds)
}

const SipFactory = Packages.javax.sip.SipFactory
const addressFactory = SipFactory.getInstance().createAddressFactory()
const locator = new Locator(dataAPIs)

export let testGroup = { name: "Location Service Module" }

// Tests
testGroup.aor_as_string = function () {
    const sipURI = addressFactory.createSipURI('john', 'sip.ocean.com')
    let aorString = LocatorUtils.aorAsString(sipURI)
    assertEquals(aorString, 'sip:john@sip.ocean.com')
    // Testing TelURL
    const telURL = addressFactory.createTelURL('tel:8095863314')
    aorString = LocatorUtils.aorAsString(telURL)
    assertEquals(aorString, 'tel:8095863314')
    // Test text format
    aorString = LocatorUtils.aorAsString('sip:john@sip.ocean.com')
    assertEquals(aorString, 'sip:john@sip.ocean.com')
}

testGroup.get_route_for_aor = function () {
    const aor = addressFactory.createSipURI('1001', 'sip.local')
    const response = locator.getEgressRouteForAOR(aor)
    assertTrue(response.status == Status.OK)
}

testGroup.get_route_for_peer = function () {
    const contactURI = addressFactory.createSipURI('ast', 'asterisk')
    const response = locator.getEgressRouteForPeer(contactURI, 'dd50baa4')
    assertTrue(response.status == Status.OK)
}

testGroup.add_find_del_aor = function() {
    const contactURI = addressFactory.createSipURI('john', 'sip.provider.com')
    const aor = contactURI
    const route = buildRoute(contactURI)

    // Add
    locator.addEndpoint(aor, route)
    // Check
    let response = locator.findEndpoint(aor)
    assertEquals(Status.OK, response.status)
    // Remove
    locator.removeEndpoint(aor)
    // Check
    response = locator.findEndpoint(aor)
    assertEquals(Status.NOT_FOUND, response.status)
}

testGroup.add_multi_aor = function() {
    const aor = addressFactory.createSipURI('john', 'domain.com')
    const contactURI1 = addressFactory.createSipURI('john', '192.168.1.2')
    const contactURI2 = addressFactory.createSipURI('john', '192.168.1.2:64232')
    const contactURI3 = addressFactory.createSipURI('jonn', '10.0.0.21')

    const route1 = buildRoute(contactURI1)
    const route2 = buildRoute(contactURI2)
    const route3 = buildRoute(contactURI3)

    // Add
    locator.addEndpoint(aor, route1)
    locator.addEndpoint(aor, route2)
    locator.addEndpoint(aor, route3)

    // Check
    let response = locator.findEndpoint(aor)
    assertEquals(3, response.result.size())

    // Remove 1
    locator.removeEndpoint(aor, contactURI1)

    // Check
    response = locator.findEndpoint(aor)
    assertEquals(2, response.result.size())

    // Remove all bindings
    locator.removeEndpoint(aor)

    // Check
    response = locator.findEndpoint(aor)
    assertEquals(Status.NOT_FOUND, response.status)
}

testGroup.get_peer_route_by_host = function() {
    const peerContactURI = addressFactory.createSipURI('ast', '192.168.1.2:5060')
    const aor = addressFactory.createSipURI('7853178070', '192.168.1.2:5060')
    const route = buildRoute(peerContactURI)

    // Add
    locator.addEndpoint(aor, route)

    // Check individual function
    let response = locator.getPeerRouteByHost(aor)
    assertEquals(Status.OK, response.status)

    // ... and main function
    response = locator.findEndpoint(aor)
    assertEquals(Status.OK, response.status)
}

function buildRoute(contactURI) {
    return {
        isLinkAOR: false,
        thruGw: false,
        sentByAddress: 'localhost',
        sentByPort: 5060,
        received: 'remotehost',
        rport: 5061,
        contactURI: contactURI,
        registeredOn: Date.now(),
        nat: false
    }
}
/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Location Service Module"
 */
import Locator from 'location/locator.js'
import DIDsAPI from 'resources/dids_api'
import DomainsAPI from 'resources/domains_api'
import GatewaysAPI from 'resources/gateways_api'
import { Status } from 'location/status'

const dataAPIs = {
    DomainsAPI: new DomainsAPI(),
    GatewaysAPI: new GatewaysAPI(),
    DIDsAPI: new DIDsAPI()
}

const SipFactory = Packages.javax.sip.SipFactory
const addressFactory = SipFactory.getInstance().createAddressFactory()
const locator = new Locator(dataAPIs)

export let testGroup = { name: "Location Service Module" }

// Tests
testGroup.aor_as_string = function () {
    const sipURI = addressFactory.createSipURI('john', 'sip.ocean.com')
    let aorString = locator.aorAsString(sipURI)
    assertEquals(aorString, 'sip:john@sip.ocean.com')
    // Testing TelURL
    const telURL = addressFactory.createTelURL('tel:8095863314')
    aorString = locator.aorAsString(telURL)
    assertEquals(aorString, 'tel:8095863314')
    // Test text format
    aorString = locator.aorAsString('sip:john@sip.ocean.com')
    assertEquals(aorString, 'sip:john@sip.ocean.com')
}

testGroup.get_route_for_aor = function () {
    const aor = addressFactory.createSipURI('john', 'sip.ocean.com')
    const result = locator.getEgressRouteForAOR(aor)
    assertTrue(result.status == Status.OK)
}

testGroup.get_route_for_peer = function () {
    const contactURI = addressFactory.createSipURI('ast', 'asterisk')
    const result = locator.getEgressRouteForPeer(contactURI, 'DID0001')
    assertTrue(result.status == Status.OK)
}

testGroup.add_find_del_aor = function() {
    const contactURI = addressFactory.createSipURI('john', 'sip.provider.com')
    const aor = contactURI
    const route = {
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

    // Add
    locator.addEndpoint(aor, route)
    // Check
    let result = locator.findEndpoint(aor)
    assertEquals(Status.OK, result.status)
    // Remove
    locator.removeEndpoint(aor)
    // Check
    result = locator.findEndpoint(aor)
    assertEquals(Status.NOT_FOUND, result.status)
}

testGroup.add_multi_aor = function() {
    const aor = addressFactory.createSipURI('john', 'domain.com')
    const contactURI1 = addressFactory.createSipURI('john', '192.168.1.2')
    const contactURI2 = addressFactory.createSipURI('john', '192.168.1.2:64232')
    const contactURI3 = addressFactory.createSipURI('jonn', '10.0.0.21')

    const route1 = {
        isLinkAOR: false,
        thruGw: false,
        sentByAddress: 'localhost',
        sentByPort: 5060,
        received: 'remotehost',
        rport: 5061,
        contactURI: contactURI1,
        registeredOn: Date.now(),
        nat: false
    }

    const route2 = {
        isLinkAOR: false,
        thruGw: false,
        sentByAddress: 'localhost',
        sentByPort: 5060,
        received: 'remotehost',
        rport: 5061,
        contactURI: contactURI2,
        registeredOn: Date.now(),
        nat: false
    }

    const route3 = {
        isLinkAOR: false,
        thruGw: false,
        sentByAddress: 'localhost',
        sentByPort: 5060,
        received: 'remotehost',
        rport: 5061,
        contactURI: contactURI3,
        registeredOn: Date.now(),
        nat: false
    }

    // Add
    locator.addEndpoint(aor, route1)
    locator.addEndpoint(aor, route2)
    locator.addEndpoint(aor, route3)

    // Check
    let result = locator.findEndpoint(aor)
    assertEquals(3, result.obj.size())

    // Remove 1
    locator.removeEndpoint(aor, contactURI1)

    // Check
    result = locator.findEndpoint(aor)
    assertEquals(2, result.obj.size())

    // Remove all bindings
    locator.removeEndpoint(aor)

    // Check
    result = locator.findEndpoint(aor)
    assertEquals(Status.NOT_FOUND, result.status)
}

testGroup.get_peer_route_by_host = function() {
    const peerContactURI = addressFactory.createSipURI('ast', '192.168.1.2:5060')
    const aor = addressFactory.createSipURI('7853178070', '192.168.1.2:5060')
    const route = {
        isLinkAOR: false,
        thruGw: false,
        sentByAddress: 'localhost',
        sentByPort: 5060,
        received: 'remotehost',
        rport: 5061,
        contactURI: peerContactURI,
        registeredOn: Date.now(),
        nat: false
    }

    // Add
    locator.addEndpoint(aor, route)

    // Check individual function
    let result = locator.getPeerRouteByHost(aor)
    assertEquals(Status.OK, result.status)

    // ... and main function
    result = locator.findEndpoint(aor)
    assertEquals(Status.OK, result.status)
}
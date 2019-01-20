/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Registry Module"
 */
import Registry from 'registry/registry'
import GatewaysAPI from 'data_api/gateways_api'
const InetAddress = Packages.java.net.InetAddress
const SipFactory = Packages.javax.sip.SipFactory
const addressFactory = SipFactory.getInstance().createAddressFactory()

const dataAPIs = {
    GatewaysAPI: new GatewaysAPI()
}

export let testGroup = { name: "Registry Module" }

// Tests
// Warning: This will fill if there is not Internet connection
testGroup.store_registry = function () {
    const registry = new Registry(null, dataAPIs)
    registry.storeRegistry(addressFactory.createSipURI('29121', 'sanjose2.voip.ms'), 200)
    assertTrue(registry.listAsJSON().length == 1)
}

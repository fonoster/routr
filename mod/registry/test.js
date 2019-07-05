/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Registry Module"
 */
const Registry = require('@routr/registry/registry')
const GatewaysAPI = require('@routr/data_api/gateways_api')

const InetAddress = Java.type('java.net.InetAddress')
const SipFactory = Java.type('javax.sip.SipFactory')

const addressFactory = SipFactory.getInstance().createAddressFactory()
const dataAPIs = {
    GatewaysAPI: new GatewaysAPI()
}
const testGroup = {
    name: "Registry Module"
}

// Tests
// Warning: This will fail if there is not Internet connection
testGroup.store_registry = function() {
    const registry = new Registry(null, dataAPIs)
    registry.storeRegistry(addressFactory.createSipURI('29121', 'sanjose2.voip.ms'), 200)
    assertTrue(registry.listAsJSON().length === 1)
}

module.exports.testGroup = testGroup

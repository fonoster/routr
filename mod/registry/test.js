/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Registry Module"
 */
const assert = require('assert')
const Registry = require('@routr/registry/registry')
const GatewaysAPI = require('@routr/data_api/gateways_api')

const InetAddress = Java.type('java.net.InetAddress')
const SipFactory = Java.type('javax.sip.SipFactory')

const addressFactory = SipFactory.getInstance().createAddressFactory()
const dataAPIs = {
    GatewaysAPI: new GatewaysAPI()
}

describe('Registry Module', () => {
    it.skip('Store registry', function(done) {
        const registry = new Registry(null, dataAPIs)
        registry.storeRegistry(addressFactory.createSipURI('29121', 'sanjose2.voip.ms'), 200)
        assert.ok(registry.listAsJSON().length === 1)
        done()
    })
})

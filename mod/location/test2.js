
describe('Location Tests v2', () => {

    const Registry = require('../registry/registry.js')
    const GatewaysAPI = require('../data_api/gateways_api.js')
    const InetAddress = Java.type('java.net.InetAddress')
    const SipFactory = Java.type('javax.sip.SipFactory')
    const addressFactory = SipFactory.getInstance().createAddressFactory()
    const dataAPIs = {
        GatewaysAPI: new GatewaysAPI()
    }

    it('No shit', function(done) {
        const registry = new Registry(null, dataAPIs)
        registry.storeRegistry(addressFactory.createSipURI('29121', 'sanjose2.voip.ms'), 200)
        assertTrue(registry.listAsJSON().length === 1)
        done()
    })

})

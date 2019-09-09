/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Registry Module"
 */
const assert = require('assert')
const Registry = require('@routr/registry/registry')
const DSSelector = require('@routr/data_api/ds_selector')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const config = require('@routr/core/config_util')()
const getProperties = require('@routr/registry/reg_properties')
const createSipListener = require('@routr/registry/sip_listener')
const createSipProvider = require('@routr/registry/sip_provider')
const buildRegRequest = require('@routr/registry/request_builder')

const {
    buildAddr,
    protocolTransport,
    nearestInterface
} = require('@routr/utils/misc_utils')

const ds = DSSelector.getDS()
const gatewaysAPI = new GatewaysAPI(ds)

describe('Registry Module', () => {
    it('Get properties', function(done) {
        const properties = getProperties('stack-0', '0.0.0.0:5060/TCP')
        assert.ok(properties.getProperty('javax.sip.STACK_NAME') !== null)
        done()
    })

    it('Create sip provider', function(done) {
        // If errors we are good...
        createSipProvider(getProperties('stack-1', '0.0.0.0:5060/TCP'), createSipListener(), void(0), 5091)
        done()
    })

    it('Build request', function(done) {
        const response = gatewaysAPI.getGateway('gw50a1a4ca')
        const gateway = response.result
        const transport = protocolTransport(config, gateway.spec.transport)
        const viaAddr = { host: transport.bindAddr, port: transport.port}
        const contactAddr = nearestInterface(transport.bindAddr, transport.port)

        // Creating sip provider
        const sipProvider = createSipProvider(getProperties('stack-2', '0.0.0.0:5060/TCP'), createSipListener(), void(0), 5092)
        const callId = sipProvider.getNewCallId()
        // If errors we are good...
        const request = buildRegRequest(gateway, contactAddr, viaAddr, callId, 1, 'routr v1.x', buildAddr)
        done()
    })

    it('Store registry', function(done) {
      //  const addressFactory = SipFactory.getInstance().createAddressFactory()
      //  const InetAddress = Java.type('java.net.InetAddress')
      //  const SipFactory = Java.type('javax.sip.SipFactory')
        /*const registry = new Registry(null)
        registry.storeRegistry(addressFactory.createSipURI('29121', 'sanjose2.voip.ms'), 200)
        assert.ok(registry.listAsJSON().length === 1)
        done()*/
        done()
    })
})

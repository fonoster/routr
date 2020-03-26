/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Registry Module"
 */
const DSSelector = require('@routr/data_api/ds_selector')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const assert = require('assert')
const config = require('@routr/core/config_util')()
const getProperties = require('@routr/registry/reg_properties')
const createSipProvider = require('@routr/registry/sip_provider')
const buildRegRequest = require('@routr/registry/request_builder')

const {
  buildAddr,
  protocolTransport,
  nearestInterface
} = require('@routr/utils/misc_utils')

const {
  isRegistered,
  isStaticMode,
  unregistered
} = require('@routr/registry/utils')

const ds = DSSelector.getDS()
const gatewaysAPI = new GatewaysAPI(ds)

describe('Registry Module', () => {
  it('Get properties', function (done) {
    const properties = getProperties('stack-0', '0.0.0.0:5060/TCP')
    assert.ok(properties.getProperty('javax.sip.STACK_NAME') !== null)
    done()
  })

  it('Create sip provider', function (done) {
    // If errors we are good...
    createSipProvider(
      getProperties('stack-1', '0.0.0.0:5060/TCP'),
      void 0,
      5091
    )
    done()
  })

  it('Build request', function (done) {
    const response = gatewaysAPI.getGateway('gw50a1a4ca')
    const gateway = response.data
    const transport = protocolTransport(config, gateway.spec.transport)
    const viaAddr = {
      host: transport.bindAddr,
      port: transport.port
    }
    const contactAddr = nearestInterface(transport.bindAddr, transport.port)

    // Creating sip provider
    const sipProvider = createSipProvider(
      getProperties('stack-2', '0.0.0.0:5060/TCP'),
      void 0,
      5092
    )
    const callId = sipProvider.getNewCallId()
    // If errors we are good...
    const request = buildRegRequest(
      gateway,
      contactAddr,
      viaAddr,
      callId,
      1,
      'routr v1.x',
      buildAddr
    )
    done()
  })

  it('Util', function (done) {
    // Check if a reg is present in
    const regs = [
      JSON.stringify({
        username: 'gw1',
        host: 'sp.labl.com',
        ip: '0.0.0.1',
        expires: 400,
        registeredOn: Date.now(),
        gwRef: 'abcd'
      })
    ]
    assert.ok(isRegistered(regs, 'abcd'))

    // Is this a static gateway?
    let response = gatewaysAPI.getGateway('gw1ec5e36a')
    const gateway = response.data
    assert.ok(isStaticMode(gateway))

    // Show the unregistered gateways
    response = gatewaysAPI.getGateways()
    const gateways = response.data
    assert.ok(unregistered(regs, gateways).length > 0)

    try {
      unregistered(null, null)
      unregistered(void 0, void 0)
      done()
    } catch (e) {
      done(e)
    }
  })
})

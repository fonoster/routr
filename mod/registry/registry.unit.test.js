/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Registry Module"
 */
const config = require('@routr/core/config_util')()
const getProperties = require('@routr/registry/reg_properties')
const createSipProvider = require('@routr/registry/sip_provider')
const buildRegRequest = require('@routr/registry/request_builder')
const RegFailureManager = require('./reg_failure_manager')
const FilesStore = require('@routr/data_api/files_store')
const chai = require('chai')
const expect = chai.expect

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
const StoreAPI = require('../data_api/store_api')

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

const gateway = {
  apiVersion: 'v1beta1',
  kind: 'Gateway',
  metadata: {
    ref: 'gw50a1a4ca',
    name: 'Provider Inc.'
  },
  spec: {
    host: 'sip.provider.net',
    port: 5061,
    transport: 'tcp',
    credentials: {
      username: 'pbx-1',
      secret: '1234'
    }
  }
}

const staticGateway = {
  apiVersion: 'v1beta1',
  kind: 'Gateway',
  metadata: {
    name: 'Provider Inc.',
    ref: 'gw1ec5e36a'
  },
  spec: {
    host: 'sip2.provider.net',
    transport: 'tcp'
  }
}

const gateways = [gateway]

describe('Registry Module', () => {
  it('gets properties', () => {
    const properties = getProperties('stack-0', '0.0.0.0:5060/TCP')
    expect(properties.getProperty('javax.sip.STACK_NAME') !== null).to.equal(
      true
    )
  })

  it('create a sip provider', () => {
    // If errors we are good...
    createSipProvider(
      getProperties('stack-1', '0.0.0.0:5060/TCP'),
      void 0,
      5091
    )
  })

  it('build a request', () => {
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
    buildRegRequest(
      gateway,
      contactAddr,
      viaAddr,
      callId,
      1,
      'routr v1.x',
      buildAddr
    )
  })

  it('test isRegistered', () => {
    // Check if a reg is present in
    expect(isRegistered(regs, 'abcd')).to.equal(true)
  })

  it('test static gw', () => {
    expect(isStaticMode(staticGateway)).to.equal(true)
  })

  it('checks if it needs registration', () => {
    // Show the unregistered gateways
    expect(unregistered(regs, gateways, []).length > 0).to.equal(true)
    unregistered(null, null)
    unregistered(void 0, void 0)
  })

  context('registration failure', () => {
    it.skip('checks if there is no reference', () => {
      const store = new StoreAPI(new FilesStore())
      const regFailureManager = new RegFailureManager(store)
      regFailureManager.clearAll()

      expect(regFailureManager.getRefs().length).to.equal(0)
      regFailureManager.reportFailure('01')
      regFailureManager.reportFailure('02')
      regFailureManager.reportFailure('02')

      expect(regFailureManager.getRefs().length).to.equal(2)
      expect(regFailureManager.getAsArray()[0].failures).to.equal(1)
      expect(regFailureManager.getAsArray()[1].failures).to.equal(2)

      regFailureManager.reportFailure('01')
      regFailureManager.reportFailure('02')
      regFailureManager.reportFailure('02')

      regFailureManager.clearCount('01')

      expect(regFailureManager.getRefs().length).to.equal(2)
      expect(regFailureManager.getAsArray()[1].failures).to.equal(4)

      regFailureManager.clearCount('01')
      regFailureManager.clearCount('02')

      expect(regFailureManager.getRefs().length).to.equal(0)
    })
  })
})

/**
 * @author Pedro Sanders
 * @since v1
 */
const InetAddress = Java.type('java.net.InetAddress')
const DSSelector = require('@routr/data_api/ds_selector')
const SDSelector = require('@routr/data_api/store_driver_selector')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const StoreAPI = require('@routr/data_api/store_api')
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
const { isExpired, unregistered } = require('@routr/registry/utils')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger(Java.type('io.routr.core.Launcher'))

var cseq = 0 // We might need to share this across instances :(

function isKnownHost (gateway) {
  try {
    InetAddress.getByName(gateway.spec.host)
    return true
  } catch (e) {
    return false
  }
}

class Registry {
  constructor () {
    // They must be at least one entry for tcp. Use it...
    const proxyTransport = protocolTransport(config, 'tcp')
    const outboundProxy = `${proxyTransport.bindAddr}:${proxyTransport.port}/${
      proxyTransport.protocol
    }`
    const properties = getProperties('routr-registry', outboundProxy)
    this.gatewaysAPI = new GatewaysAPI(DSSelector.getDS(config))
    this.sipProvider = createSipProvider(properties)
    this.sipProvider.addSipListener(
      createSipListener(this, this.sipProvider.getSipStack(), this.gatewaysAPI)
    )

    this.userAgent = config.metadata.userAgent
    this.store = new StoreAPI(SDSelector.getDriver())
  }

  async register (gateway, received, rport) {
    const gatewayCopy = gateway

    if (gatewayCopy?.spec.credentials?.secret) {
      gatewayCopy.spec.credentials.secret = '/REDACTED/'
    }

    LOG.debug(
      `registry.Registry.register [gateway ${JSON.stringify(gatewayCopy)}]`
    )

    if (!isKnownHost(gateway)) {
      LOG.warn(`registry.Registry.register [unknown host ${gateway.spec.host}]`)
      return
    }

    const lp = this.sipProvider.getListeningPoint(gateway.spec.transport)
    const viaAddr = {
      host: lp.getIPAddress(),
      port: lp.getPort()
    }
    // Use the proxy's address info
    const proxyTransport = protocolTransport(config, gateway.spec.transport)
    const contactAddr = nearestInterface(
      proxyTransport.bindAddr,
      proxyTransport.port,
      received,
      rport
    )

    const callId = this.sipProvider.getNewCallId()
    const request = buildRegRequest(
      gateway,
      contactAddr,
      viaAddr,
      callId,
      cseq++,
      this.userAgent,
      buildAddr
    )

    const clientTransaction = this.sipProvider.getNewClientTransaction(request)
    clientTransaction.sendRequest()
  }

  registerAll () {
    LOG.debug('registry.Registry.registerAll [sending gateways registration]')

    this.store
      .withCollection('registry')
      .values()
      .forEach(r => {
        const reg = JSON.parse(r)
        if (isExpired(reg)) {
          LOG.debug(
            `registry.Registry.registerAll [removing expired registry \`${
              reg.gwURI
            }\`]`
          )
          this.store.remove(reg.gwURI)
        }
      })
    const gateways = this.gatewaysAPI.getGateways().data
    const unreg = unregistered(
      this.store.withCollection('registry').values(),
      gateways
    )
    unreg.forEach(gw => this.register(gw))
  }
}

reg = new Registry()

/**
 * @author Pedro Sanders
 * @since v1
 */
const DSSelector = require('@routr/data_api/ds_selector')
const SDSelector = require('@routr/data_api/store_driver_selector')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const StoreAPI = require('@routr/data_api/store_api')
const config = require('@routr/core/config_util')()
const getProperties = require('@routr/registry/reg_properties')
const createSipListener = require('@routr/registry/sip_listener')
const createSipProvider = require('@routr/registry/sip_provider')
const buildRegRequest = require('@routr/registry/request_builder')
const { connectionException } = require('@routr/utils/exception_helpers')
const {
    buildAddr,
    protocolTransport,
    nearestInterface
} = require('@routr/utils/misc_utils')
const {
    isRegistered,
    isExpired,
    isStaticMode,
    unregistered,
} = require('@routr/registry/utils')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

var cseq = 0  // We might need to share this across instances :(

class Registry {

    constructor() {
        // They must be at least one entry for tcp. Use it...
        const proxyTransport = protocolTransport(config, 'tcp')
        const outboundProxy = `${proxyTransport.bindAddr}:${proxyTransport.port}/${proxyTransport.protocol}`
        const properties = getProperties('routr-registry', outboundProxy)
        this.gatewaysAPI = new GatewaysAPI(DSSelector.getDS())
        this.sipProvider = createSipProvider(properties)
        this.sipProvider.addSipListener(
          createSipListener(this, this.sipProvider.getSipStack(),
            this.gatewaysAPI))

        this.userAgent = config.metadata.userAgent
        this.store = new StoreAPI(SDSelector.getDriver())
    }

    register(gateway, received, rport) {
        LOG.debug(`registry.Registry.register [gateway ${JSON.stringify(gateway)}]`)
        const lp = this.sipProvider.getListeningPoint(gateway.spec.transport)
        const viaAddr = { host: lp.getIPAddress(), port: lp.getPort()}
        // Use the proxys addrs info
        const proxyTransport = protocolTransport(config, gateway.spec.transport)
        const contactAddr = nearestInterface(proxyTransport.bindAddr,
          proxyTransport.port, received, rport)

        const callId = this.sipProvider.getNewCallId()
        const request = buildRegRequest(gateway, contactAddr, viaAddr, callId,
          cseq++, this.userAgent, buildAddr)
        Registry.sendRequest(this.sipProvider, request)
    }

    registerAll() {
        LOG.debug(`registry.Registry.registerAll [sending gateways registration]`)
        this.store.withCollection('registry').values().forEach(r => {
            const reg = JSON.parse(r)
            if (isExpired(reg)) {
                LOG.debug(`registry.Registry.registerAll [removing expired registry \`${reg.gwURI}\`]`)
                this.store.remove(reg.gwURI)
            }
        })
        const gateways = this.gatewaysAPI.getGateways().data
        const unreg = unregistered(
          this.store.withCollection('registry').values(), gateways)
        unreg.forEach(gw => this.register(gw))
    }

    static sendRequest(sipProvider, request) {
        try {
            const clientTransaction = sipProvider
              .getNewClientTransaction(request)
            clientTransaction.sendRequest()
        } catch(e) {
            connectionException(e, request.getRequestURI().toString())
        }
    }
}

module.exports = Registry

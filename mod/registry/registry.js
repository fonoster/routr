/**
 * @author Pedro Sanders
 * @since v1
 */
const System = Java.type('java.lang.System')
const NHTClient = Java.type('io.routr.nht.NHTClient')
load(`${System.getProperty('user.dir')}/libs/jvm-npm.js`)
const DSSelector = require('@routr/data_api/ds_selector')
const GatewaysAPI = require('@routr/data_api/gateways_api')
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
        this.registryStore = new NHTClient('vm:/routr')
        this.sipProvider = createSipProvider(properties)
        try {
            this.sipProvider.addSipListener(
                createSipListener(this.sipProvider.getSipStack(),
                    this.gatewaysAPI, this.registryStore))
        } catch(e) {
            // I'm having issues while trying to creating new instances of
            // the class Registry.
        }
        this.userAgent = config.metadata.userAgent
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
        LOG.debug(`registry.Registry.registerAll [beging registry of all gateways]`)
        // Filter unexpired and static gateway
        const response = this.gatewaysAPI.getGateways()
        const gateways = response.result
        gateways.forEach(gateway => this.register(gateway))
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

/**
 * @author Pedro Sanders
 * @since v1
 */
import Processor from 'core/processor/processor'
import ContextStorage from 'core/context_storage'
import Registry from 'registry/registry'
import RestService from 'rest/rest'
import DSUtil from 'data_api/utils'
import { Status } from 'data_api/status'
import getConfig from 'core/config_util.js'

const InetAddress = Packages.java.net.InetAddress
const SipFactory = Packages.javax.sip.SipFactory
const Properties = Packages.java.util.Properties
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()
const ANSI_GREEN = "\u001B[32m"
const ANSI_YELLOW = "\u001B[33m"
const ANSI_RESET = "\u001B[0m"

export default class Server {

    constructor(locator, registrar, dataAPIs) {
        this.locator = locator
        this.registrar = registrar
        this.dataAPIs = dataAPIs
        this.contextStorage = new ContextStorage()
        this.config = getConfig()
        // Not sure if this is a good idea in terms of performance
        this.regTimeout = 0.6
        this.host = this.config.spec.bindAddr
    }

    start()  {
        const host = this.host
        const config = this.config
        const locator = this.locator
        const registrar = this.registrar
        const dataAPIs = this.dataAPIs
        const contextStorage = this.contextStorage
        const regTimeout = this.regTimeout

        LOG.info('Starting Sip I/O')

        const properties = new Properties()
        const sipFactory = SipFactory.getInstance()

        // See https://github.com/RestComm/jain-sip/blob/master/src/gov/nist/javax/sip/SipStackImpl.java for
        // many other options
        sipFactory.setPathName('gov.nist')
        properties.setProperty('javax.sip.STACK_NAME', 'sipio')
        // Default host
        properties.setProperty('javax.sip.IP_ADDRESS', host)
        properties.setProperty('javax.sip.AUTOMATIC_DIALOG_SUPPORT', 'OFF')
        // Guard against denial of service attack.
        properties.setProperty('gov.nist.javax.sip.MAX_MESSAGE_SIZE', '1048576')
        // Drop the client connection after we are done with the transaction.
        properties.setProperty('gov.nist.javax.sip.CACHE_CLIENT_CONNECTIONS', 'false')
        properties.setProperty('gov.nist.javax.sip.TRACE_LEVEL', config.spec.logging.traceLevel)
        properties.setProperty('gov.nist.javax.sip.MESSAGE_PROCESSOR_FACTORY', 'gov.nist.javax.sip.stack.NioMessageProcessorFactory')
        properties.setProperty('gov.nist.javax.sip.PATCH_SIP_WEBSOCKETS_HEADERS', 'false')

        // See https://groups.google.com/forum/#!topic/mobicents-public/U_c7aLAJ_MU for useful info
        if (config.spec.securityContext) {
            properties.setProperty('gov.nist.javax.sip.TLS_CLIENT_PROTOCOLS', config.spec.securityContext.client.protocols.join())
            // This must be set to 'Disabled' when using WSS
            properties.setProperty('gov.nist.javax.sip.TLS_CLIENT_AUTH_TYPE', config.spec.securityContext.client.authType)
            properties.setProperty('javax.net.ssl.keyStore', config.spec.securityContext.keyStore)
            properties.setProperty('javax.net.ssl.trustStore', config.spec.securityContext.trustStore)
            properties.setProperty('javax.net.ssl.keyStorePassword', config.spec.securityContext.keyStorePassword)
            properties.setProperty('javax.net.ssl.keyStoreType', config.spec.securityContext.keyStoreType)

            if (config.spec.securityContext.debugging) {
                Packages.java.lang.System.setProperty('javax.net.debug', 'ssl')
            }
        }

        this.sipStack = sipFactory.createSipStack(properties)

        const defTransport = this.sipStack.createListeningPoint(config.spec.transport[0].port,
            config.spec.transport[0].protocol.toLowerCase())

        const sipProvider = this.sipStack.createSipProvider(defTransport)

        if (this.config.spec.externAddr) LOG.info("ExternAddr is " + ANSI_GREEN  + this.config.spec.externAddr + ANSI_RESET)
        if (this.config.spec.externAddr && this.config.spec.localnets) LOG.info("Localnets  is " + ANSI_GREEN  + this.config.spec.localnets.join(",") + ANSI_RESET)

        for (const key in config.spec.transport) {
            const transport = config.spec.transport[key]
            const proto = transport.protocol.toLowerCase()

            if ((proto == 'wss' || proto == 'tls') && !config.spec.securityContext) {
                LOG.warn(ANSI_YELLOW + 'Security context not found. Ignoring protocol: ' + proto + ANSI_RESET)
                continue;
            }

            if (transport.bindAddr == undefined) transport.bindAddr = this.host

            const lp = this.sipStack.createListeningPoint(transport.bindAddr, transport.port, proto)
            sipProvider.addListeningPoint(lp)

            LOG.info('Listening  on ' + ANSI_GREEN  + transport.bindAddr
                + ':' + transport.port
                    + ' [' + proto + ']'
                        + ANSI_RESET)
        }

        const registry = new Registry(sipProvider, dataAPIs)
        const processor = new Processor(sipProvider, locator, registry, registrar, dataAPIs, contextStorage)

        sipProvider.addSipListener(processor.listener)

        locator.start()
        registry.start()
        this.restService = new RestService(this, locator, registry, dataAPIs)
        this.restService.start()
        java.lang.Thread.sleep(java.lang.Long.MAX_VALUE)
    }

    stop() {
        LOG.info('Stopping server')
        this.restService.stop()
        this.sipStack.stop()
        this.locator.stop()
        exit(0)
    }
}

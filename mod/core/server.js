/**
 * @author Pedro Sanders
 * @since v1
 */
import Processor from 'core/processor/processor'
import ContextStorage from 'core/context_storage'
import Registry from 'registry/registry'
import RestService from 'rest/rest'
import getConfig from 'core/config_util.js'

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
        this.host = this.config.spec.bindAddr
    }

    buildSipProvider(transport) {
        const defListeningPoint = this.sipStack.createListeningPoint(transport[0].port, transport[0].protocol.toLowerCase())
        const sipProvider = this.sipStack.createSipProvider(defListeningPoint)

        for (const key in transport) {
            const curTransport = transport[key]
            const proto = curTransport.protocol.toLowerCase()

            if ((proto == 'wss' || proto == 'tls') && !this.config.spec.securityContext) {
                LOG.warn(ANSI_YELLOW + 'Security context could not found. Ignoring protocol: ' + proto + ANSI_RESET)
                continue;
            }

            if (curTransport.bindAddr == undefined) {
                curTransport.bindAddr = this.host
            }

            const lp = this.sipStack.createListeningPoint(curTransport.bindAddr, curTransport.port, proto)
            sipProvider.addListeningPoint(lp)

            LOG.info('Listening  on ' + ANSI_GREEN  + curTransport.bindAddr
                + ':' + curTransport.port
                    + ' [' + proto + ']'
                        + ANSI_RESET)
        }

        return sipProvider
    }

    showExternInfo() {
        if (this.config.spec.externAddr) {
            LOG.info("ExternAddr is " + ANSI_GREEN  + this.config.spec.externAddr + ANSI_RESET)

            if(this.config.spec.localnets) {
                LOG.info("Localnets  is " + ANSI_GREEN  + this.config.spec.localnets.join(",") + ANSI_RESET)
            }
        }
    }

    setup() {
        this.showExternInfo()

        if(this.config.spec.securityContext.debugging) {
            Packages.java.lang.System.setProperty('javax.net.debug', 'ssl')
        }

        const sipFactory = SipFactory.getInstance()
        sipFactory.setPathName('gov.nist')

        this.sipStack = sipFactory.createSipStack(this.getProperties())

        const sipProvider = this.buildSipProvider(this.config.spec.transport)

        this.registry = new Registry(sipProvider, this.dataAPIs)

        const processor = new Processor(sipProvider,
            this.locator,
                this.registry,
                    this.registrar, this.dataAPIs, this.contextStorage)

        sipProvider.addSipListener(processor.listener)
    }

    start()  {
        LOG.info('Starting Sip I/O')
        this.setup()
        this.locator.start()
        this.registry.start()
        this.restService = new RestService(this, this.locator, this.registry, this.dataAPIs)
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

    getProperties() {
        const properties = new Properties()
        // See https://github.com/RestComm/jain-sip/blob/master/src/gov/nist/javax/sip/SipStackImpl.java for
        // many other options
        properties.setProperty('javax.sip.STACK_NAME', 'sipio')
        // Default host
        properties.setProperty('javax.sip.IP_ADDRESS', this.host)
        properties.setProperty('javax.sip.AUTOMATIC_DIALOG_SUPPORT', 'OFF')
        // Guard against denial of service attack.
        properties.setProperty('gov.nist.javax.sip.MAX_MESSAGE_SIZE', '1048576')
        // Drop the client connection after we are done with the transaction.
        properties.setProperty('gov.nist.javax.sip.CACHE_CLIENT_CONNECTIONS', 'false')
        properties.setProperty('gov.nist.javax.sip.TRACE_LEVEL', this.config.spec.logging.traceLevel)
        properties.setProperty('gov.nist.javax.sip.MESSAGE_PROCESSOR_FACTORY', 'gov.nist.javax.sip.stack.NioMessageProcessorFactory')
        properties.setProperty('gov.nist.javax.sip.PATCH_SIP_WEBSOCKETS_HEADERS', 'false')

        // See https://groups.google.com/forum/#!topic/mobicents-public/U_c7aLAJ_MU for useful info
        if (this.config.spec.securityContext) {
            properties.setProperty('gov.nist.javax.sip.TLS_CLIENT_PROTOCOLS', this.config.spec.securityContext.client.protocols.join())
            // This must be set to 'Disabled' when using WSS
            properties.setProperty('gov.nist.javax.sip.TLS_CLIENT_AUTH_TYPE', this.config.spec.securityContext.client.authType)
            properties.setProperty('javax.net.ssl.keyStore', this.config.spec.securityContext.keyStore)
            properties.setProperty('javax.net.ssl.trustStore', this.config.spec.securityContext.trustStore)
            properties.setProperty('javax.net.ssl.keyStorePassword', this.config.spec.securityContext.keyStorePassword)
            properties.setProperty('javax.net.ssl.keyStoreType', this.config.spec.securityContext.keyStoreType)
        }
        return properties
    }

}

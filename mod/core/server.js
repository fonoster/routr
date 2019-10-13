/**
 * @author Pedro Sanders
 * @since v1
 */
const UsersAPI = require('@routr/data_api/users_api')
const AgentsAPI = require('@routr/data_api/agents_api')
const DomainsAPI = require('@routr/data_api/domains_api')
const PeersAPI = require('@routr/data_api/peers_api')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const NumbersAPI = require('@routr/data_api/numbers_api')
const DSSelector = require('@routr/data_api/ds_selector')
const Processor = require('@routr/core/processor/processor')
const Locator = require('@routr/location/locator')
const ContextStorage = require('@routr/core/context_storage')
const config = require('@routr/core/config_util')()

const BasicConfigurator = Java.type('org.apache.log4j.BasicConfigurator')
const NullAppender = Java.type('org.apache.log4j.varia.NullAppender')
const FileInputStream = Java.type('java.io.FileInputStream')
const System = Java.type('java.lang.System')
const SipFactory = Java.type('javax.sip.SipFactory')
const Properties = Java.type('java.util.Properties')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')

const LOG = LogManager.getLogger()
const ANSI_GREEN = "\u001B[32m"
const ANSI_YELLOW = "\u001B[33m"
const ANSI_RESET = "\u001B[0m"

class Server {

    constructor() {
        // Mutes legacy loggers
        BasicConfigurator.configure(new NullAppender())

        const ds = DSSelector.getDS()
        const dataAPIs = {
            UsersAPI: new UsersAPI(ds),
            AgentsAPI: new AgentsAPI(ds),
            DomainsAPI: new DomainsAPI(ds),
            NumbersAPI: new NumbersAPI(ds),
            GatewaysAPI: new GatewaysAPI(ds),
            PeersAPI: new PeersAPI(ds)
        }

        this.dataAPIs = dataAPIs
        new Locator()
    }

    buildSipProvider(sipStack, transport) {
        const defListeningPoint = sipStack.createListeningPoint(transport[0].port, transport[0].protocol.toLowerCase())
        const sipProvider = sipStack.createSipProvider(defListeningPoint)

        for (const key in transport) {
            const curTransport = transport[key]
            const proto = curTransport.protocol.toLowerCase()

            if ((proto === 'wss' || proto === 'tls') && !config.spec.securityContext) {
                LOG.warn(`${ANSI_YELLOW }Security context could not found. Ignoring protocol: ${proto}${ANSI_RESET}`)
                continue
            }

            if (curTransport.bindAddr === undefined) {
                curTransport.bindAddr = config.spec.bindAddr
            }

            const lp = sipStack.createListeningPoint(curTransport.bindAddr, curTransport.port, proto)
            sipProvider.addListeningPoint(lp)

            LOG.info(`Listening on ${ANSI_GREEN}${curTransport.bindAddr}:${curTransport.port} [${proto}]${ANSI_RESET}`)
        }

        return sipProvider
    }

    setup() {
        this.showExternInfo()

        if (config.spec.securityContext.debugging) {
            Java.type('java.lang.System').setProperty('javax.net.debug', 'ssl')
        }

        const sipFactory = SipFactory.getInstance()
        sipFactory.setPathName('gov.nist')

        this.sipStack = sipFactory.createSipStack(this.getProperties(config))

        const sipProvider = this.buildSipProvider(this.sipStack,
            config.spec.transport)

        const processor = new Processor(sipProvider, this.dataAPIs, new ContextStorage(sipProvider))

        sipProvider.addSipListener(processor.listener)
    }

    start() {
        LOG.info('Starting Routr')
        this.setup()
    }

    stop() {
        LOG.info('Stopping server')
        this.sipStack.stop()
        System.exit(0)
    }

    // TODO: Take this to is own file :(
    getProperties(config) {
        const properties = new Properties()
        // for more options see:
        // https://github.com/RestComm/jain-sip/blob/master/src/gov/nist/javax/sip/SipStackImpl.java
        properties.setProperty('javax.sip.STACK_NAME', 'routr')
        properties.setProperty('javax.sip.AUTOMATIC_DIALOG_SUPPORT', 'OFF')
        properties.setProperty('gov.nist.javax.sip.MESSAGE_PROCESSOR_FACTORY', 'gov.nist.javax.sip.stack.NioMessageProcessorFactory')
        properties.setProperty('gov.nist.javax.sip.PATCH_SIP_WEBSOCKETS_HEADERS', 'false')
        properties.setProperty('gov.nist.javax.sip.CACHE_CLIENT_CONNECTIONS', 'true')
        properties.setProperty('gov.nist.javax.sip.REENTRANT_LISTENER', 'false')
        properties.setProperty('gov.nist.javax.sip.THREAD_POOL_SIZE', '16')
        properties.setProperty('gov.nist.javax.sip.NIO_BLOCKING_MODE', 'NONBLOCKING')

        // Guard against denial of service attack.
        properties.setProperty('gov.nist.javax.sip.MAX_MESSAGE_SIZE', '1048576')
        properties.setProperty('gov.nist.javax.sip.LOG_MESSAGE_CONTENT', 'false')
        //properties.setProperty('gov.nist.javax.sip.TRACE_LEVEL', config.spec.logging.traceLevel)

        // Default host
        properties.setProperty('javax.sip.IP_ADDRESS', config.spec.bindAddr)

        // See https://groups.google.com/forum/#!topic/mobicents-public/U_c7aLAJ_MU for useful info
        if (config.spec.securityContext) {
            properties.setProperty('gov.nist.javax.sip.TLS_CLIENT_PROTOCOLS', config.spec.securityContext.client.protocols.join())
            // This must be set to 'Disabled' when using WSS
            properties.setProperty('gov.nist.javax.sip.TLS_CLIENT_AUTH_TYPE', config.spec.securityContext.client.authType)
            properties.setProperty('javax.net.ssl.keyStore', config.spec.securityContext.keyStore)
            properties.setProperty('javax.net.ssl.trustStore', config.spec.securityContext.trustStore)
            properties.setProperty('javax.net.ssl.keyStorePassword', config.spec.securityContext.keyStorePassword)
            properties.setProperty('javax.net.ssl.keyStoreType', config.spec.securityContext.keyStoreType)
        }

        try {
            const filesPath = config.spec.dataSource.parameters.path
            properties.load(new FileInputStream(`${filesPath}/stack.properties`))
        } catch (e) {}

        return properties
    }

    showExternInfo() {
        if (config.spec.externAddr) {
            LOG.info(`ExternAddr is ${ANSI_GREEN}${config.spec.externAddr}${ANSI_RESET}`)

            if (config.spec.localnets) {
                LOG.info(`Localnets is ${ANSI_GREEN}${config.spec.localnets.join(',')}${ANSI_RESET}`)
            }
        }
    }

}

module.exports = Server

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
const showExternInfo = require('@routr/core/extern_info')
const config = require('@routr/core/config_util')()
const properties = require('@routr/core/server_properties')(config)

const BasicConfigurator = Java.type('org.apache.log4j.BasicConfigurator')
const NullAppender = Java.type('org.apache.log4j.varia.NullAppender')
const System = Java.type('java.lang.System')
const SipFactory = Java.type('javax.sip.SipFactory')
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
        this.locator = new Locator()
    }

    buildSipProvider(sipStack, transport) {
        let sipProvider

        for (const key in transport) {
            const curTransport = transport[key]
            const proto = curTransport.protocol.toLowerCase()

            if ((proto === 'wss' || proto === 'tls') && !config.spec.securityContext) {
                LOG.warn(`${ANSI_YELLOW }Unable to find security context. Ignoring protocol: ${proto}${ANSI_RESET}`)
                continue
            }

            if (curTransport.bindAddr === undefined) {
                curTransport.bindAddr = config.spec.bindAddr
            }

            const lp = sipStack.createListeningPoint(curTransport.bindAddr, curTransport.port, proto)

            if(sipProvider) {
                sipProvider.addListeningPoint(lp)
            } else {
                sipProvider = sipStack.createSipProvider(lp)
            }

            LOG.info(`Listening on ${ANSI_GREEN}${curTransport.bindAddr}:${curTransport.port} [${proto}]${ANSI_RESET}`)
        }

        return sipProvider
    }

    setup() {
        showExternInfo(config)
        if (config.spec.securityContext.debugging) {
            Java.type('java.lang.System')
                .setProperty('javax.net.debug', 'ssl')
        }
        const sipFactory = SipFactory.getInstance()
        sipFactory.setPathName('gov.nist')
        this.sipStack = sipFactory.createSipStack(properties)
        const sipProvider = this.buildSipProvider(this.sipStack,
            config.spec.transport)
        const ctxStorage = new ContextStorage(sipProvider)
        const processor = new Processor(sipProvider, this.dataAPIs, ctxStorage)
        sipProvider.addSipListener(processor.listener)
        this.ctxStorage = ctxStorage
    }

    start() {
        LOG.info('Starting Routr')
        this.setup()
    }

    stop(code = 0) {
        LOG.info('Stopping server')
        try {
            this.sipStack.stop()
        } catch(e) {}
        System.exit(code)
    }

    stopIfReady(code = 0) {
        if (this.ctxStorage.getStorage().size() === 0) {
            this.stop(code)
        }
        LOG.info(`Waiting for ${this.ctxStorage.getStorage().size()} transactions before shutdown`)
    }
}

server = new Server()
server.start()

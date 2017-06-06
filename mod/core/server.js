/**
 * @author Pedro Sanders
 * @since v1
 */
import Processor from 'core/processor/processor'
import ContextStorage from 'core/context_storage'
import Registry from 'registry/registry'
import RestService from 'rest/rest'
import ResourcesUtil from 'resources/utils'
import getConfig from 'core/config_util.js'
import { Status } from 'resources/status'

const InetAddress = Packages.java.net.InetAddress
const SipFactory = Packages.javax.sip.SipFactory
const Properties = Packages.java.util.Properties
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()
const ANSI_GREEN = "\u001B[32m"
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
        this.host = InetAddress.getLocalHost().getHostAddress()
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
        LOG.info('Listening on IP: ' + ANSI_GREEN + host + ANSI_RESET)
        if (config.general.externalHost != undefined) LOG.info('External Host: ' + config.general.externalHost)

        const properties = new Properties()
        const sipFactory = SipFactory.getInstance()

        sipFactory.setPathName('gov.nist')
        properties.setProperty('javax.sip.STACK_NAME', 'sipio')
        properties.setProperty('javax.sip.IP_ADDRESS', host)
        properties.setProperty('javax.sip.AUTOMATIC_DIALOG_SUPPORT', 'OFF')
        // Guard against denial of service attack.
        properties.setProperty('gov.nist.javax.sip.MAX_MESSAGE_SIZE', '1048576')
        // Drop the client connection after we are done with the transaction.
        properties.setProperty('gov.nist.javax.sip.CACHE_CLIENT_CONNECTIONS', 'false')
        properties.setProperty('gov.nist.javax.sip.TRACE_LEVEL', config.general.traceLevel)
        // This seems to work with ws but not with udp
        properties.setProperty('gov.nist.javax.sip.MESSAGE_PROCESSOR_FACTORY', 'gov.nist.javax.sip.stack.NioMessageProcessorFactory')
        properties.setProperty('gov.nist.javax.sip.PATCH_SIP_WEBSOCKETS_HEADERS', 'false')

        // I have not tested this yet but a least suppress some annoying warnings
        properties.setProperty('javax.net.ssl.keyStore', 'etc/keystore.jks')
        properties.setProperty('javax.net.ssl.keyStoreType', 'jks')
        properties.setProperty('javax.net.ssl.keyStorePassword', 'osopolar')
        properties.setProperty('javax.net.ssl.trustStore', 'etc/keystore.jks')
        properties.setProperty('javax.net.ssl.trustStorePassword', 'osopolar')
        properties.setProperty('javax.net.ssl.trustStoreType', 'jks')

        this.sipStack = sipFactory.createSipStack(properties)

        const messageFactory = sipFactory.createMessageFactory()
        const headerFactory = sipFactory.createHeaderFactory()
        const addressFactory = sipFactory.createAddressFactory()
        const tcp = this.sipStack.createListeningPoint(config.general.tcpPort, 'tcp')
        const udp = this.sipStack.createListeningPoint(config.general.udpPort, 'udp')
        const ws = this.sipStack.createListeningPoint(config.general.wsPort, 'ws')
        const tls = this.sipStack.createListeningPoint(config.general.tlsPort, 'tls')

        const sipProvider = this.sipStack.createSipProvider(tcp)
        sipProvider.addListeningPoint(udp)
        sipProvider.addListeningPoint(ws)
        sipProvider.addListeningPoint(tls)

        // Server's contact address and header
        const serverAddress = addressFactory.createAddress('sip:' + host)
        const serverContactHeader = headerFactory.createContactHeader(serverAddress)

        const registry = new Registry(sipProvider)
        const processor = new Processor(sipProvider, locator, registry, registrar, dataAPIs, contextStorage)

        sipProvider.addSipListener(processor.listener)

        let registerTask = new java.util.TimerTask({
            run: function() {
                const result = dataAPIs.GatewaysAPI.getGateways()
                if (result.status != Status.OK) return

                result.obj.forEach (function(gateway) {
                    LOG.debug('Register with ' + gateway.metadata.name +  ' using '
                        + gateway.spec.regService.credentials.username + '@' + gateway.spec.regService.host)

                    let regService = gateway.spec.regService

                    if (!registry.hasHost(regService.host)) {
                        registry.requestChallenge(regService.credentials.username,
                            gateway.metadata.ref, regService.host, regService.transport)
                    }

                    let registries = gateway.spec.regService.registries

                    if (registries != undefined) {
                        registries.forEach (function(h) {
                            if (!registry.hasHost(regService.host)) {
                                LOG.debug('Register with ' + gateway.metadata.name +  ' using '  + gateway.spec.regService.credentials.username + '@' + h)
                                registry.requestChallenge(gateway.spec.regService.credentials.username, gateway.metadata.ref, h, gateway.spec.regService.transport)
                            }
                        })
                    }
                })
           }
        })
        new java.util.Timer().schedule(registerTask, 5000, regTimeout * 60 * 1000)

        locator.start()
        registry.start()
        this.restService = new RestService(this, locator, registry, dataAPIs)
        this.restService.start()
    }

    stop() {
        LOG.info('Stopping server')
        this.restService.stop()
        this.sipStack.stop()
        this.locator.stop()
        exit(0)
    }
}

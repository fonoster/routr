/**
 * @author Pedro Sanders
 * @since v1
 */
import Processor from 'core/processor'
import RegistryHelper from 'core/registry_helper'
import ContextStorage from 'core/context_storage'
import RestService from 'rest/rest'
import ResourcesUtil from 'resources/utils'
import getConfig from 'core/config_util.js'
import { Status } from 'resources/status'

const InetAddress = Packages.java.net.InetAddress
const SipFactory = Packages.javax.sip.SipFactory
const Properties = Packages.java.util.Properties
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()

export default class Server {

    constructor(locationService, registrarService, dataAPIs) {
        this.locationService = locationService
        this.registrarService = registrarService
        this.dataAPIs = dataAPIs
        this.contextStorage = new ContextStorage()
        this.config = getConfig()
        // Registration with gateways expire in 5 minutes, so we will re-register in 4
        this.regTimeout = 4
        this.host = InetAddress.getLocalHost().getHostAddress()
    }

    start()  {
        const host = this.host
        const config = this.config
        const locationService = this.locationService
        const registrarService = this.registrarService
        const dataAPIs = this.dataAPIs
        const contextStorage = this.contextStorage
        const regTimeout = this.regTimeout

        LOG.info('Starting Sip I/O')
        LOG.info('Listening on IP ' + host)
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

        const processor = new Processor(sipProvider, serverContactHeader,
           locationService, registrarService, dataAPIs, contextStorage)

        sipProvider.addSipListener(processor.listener)

        const registerHelper = new RegistryHelper(sipProvider, headerFactory, messageFactory, addressFactory)

        let registerTask = new java.util.TimerTask({
            run: function() {
                const result = dataAPIs.GatewaysAPI.getGateways()
                if (result.status != Status.OK) return

                result.obj.forEach (function(gateway) {
                    LOG.debug('Register with ' + gateway.metadata.name +  ' using '
                        + gateway.spec.regService.credentials.username + '@' + gateway.spec.regService.host)

                    let regService = gateway.spec.regService

                    if (regService.host !== undefined) registerHelper.requestChallenge(regService.credentials.username,
                        gateway.metadata.ref, regService.host, regService.transport)

                    let registries = gateway.spec.regService.registries

                    if (registries != undefined) {
                        registries.forEach (function(h) {
                            LOG.debug('Register with ' + gateway.metadata.name +  ' using '  + gateway.spec.regService.credentials.username + '@' + h)

                            registerHelper.requestChallenge(gateway.spec.regService.credentials.username, gateway.metadata.ref, h, gateway.spec.regService.transport)
                        })
                    }
                })
           }
        })

        new java.util.Timer().schedule(registerTask, 5000, regTimeout * 60 * 1000)

        this.restService = new RestService(this, locationService, dataAPIs)
        this.restService.start()
    }

    stop() {
        LOG.info('Stopping server')
        this.restService.stop()
        this.sipStack.stop()
        exit(0)
    }
}

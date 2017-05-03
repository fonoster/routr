/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/core/processor.js')
load('mod/core/registry_helper.js')
load('mod/core/context_storage.js')
load('mod/rest/rest.js')

function Server(locationService, registrarService, accountManagerService, resourcesAPI) {
    const contextStorage = new ContextStorage()
    const config = resourcesAPI.getConfig()
    const InetAddress = Packages.java.net.InetAddress
    const SipFactory = Packages.javax.sip.SipFactory
    const Properties = Packages.java.util.Properties
    const LogManager = Packages.org.apache.logging.log4j.LogManager
    const LOG = LogManager.getLogger()
    let restService
    let sipStack

    const host = InetAddress.getLocalHost().getHostAddress()

    // Registration with gateways expire in 5 minutes, so we will re-register in 4
    const proRegExp = 4

    this.start = () => {
        LOG.info('Starting Sip I/O')
        LOG.debug('Local Host: ' + host)
        if (config.general.externalHost != undefined) LOG.debug('External Host: ' + config.general.externalHost)

        const properties = new Properties()
        const sipFactory = SipFactory.getInstance()

        sipFactory.setPathName('gov.nist')
        properties.setProperty('javax.sip.STACK_NAME', 'sipio')
        properties.setProperty('javax.sip.IP_ADDRESS', host)
        properties.setProperty('javax.sip.AUTOMATIC_DIALOG_SUPPORT', 'OFF')
        // Guard against denial of service attack.
        properties.setProperty('gov.nist.javax.sip.MAX_MESSAGE_SIZE', '1048576');
        // Drop the client connection after we are done with the transaction.
        properties.setProperty('gov.nist.javax.sip.CACHE_CLIENT_CONNECTIONS', 'false');
        properties.setProperty('gov.nist.javax.sip.TRACE_LEVEL', config.general.traceLevel);
        // This seems to work with ws but not with udp
        properties.setProperty('gov.nist.javax.sip.MESSAGE_PROCESSOR_FACTORY', 'gov.nist.javax.sip.stack.NioMessageProcessorFactory')
        properties.setProperty('gov.nist.javax.sip.PATCH_SIP_WEBSOCKETS_HEADERS', 'false')

        // I have not tested this yet but a least suppress some annoying warnings
        properties.setProperty('javax.net.ssl.keyStore', 'keystore.jks')
        properties.setProperty('javax.net.ssl.keyStoreType', 'jks')
        properties.setProperty('javax.net.ssl.keyStorePassword', 'osopolar')
        properties.setProperty('javax.net.ssl.trustStore', 'keystore.jks')
        properties.setProperty('javax.net.ssl.trustStorePassword', 'osopolar')
        properties.setProperty('javax.net.ssl.trustStoreType', 'jks')

        sipStack = sipFactory.createSipStack(properties)

        const messageFactory = sipFactory.createMessageFactory()
        const headerFactory = sipFactory.createHeaderFactory()
        const addressFactory = sipFactory.createAddressFactory()
        const tcp = sipStack.createListeningPoint(config.general.tcpPort, 'tcp')
        const udp = sipStack.createListeningPoint(config.general.udpPort, 'udp')
        const ws = sipStack.createListeningPoint(config.general.wsPort, 'ws')
        const tls = sipStack.createListeningPoint(config.general.tlsPort, 'tls')

        const sipProvider = sipStack.createSipProvider(tcp)
        sipProvider.addListeningPoint(udp)
        sipProvider.addListeningPoint(ws)
        sipProvider.addListeningPoint(tls)

        // Server's contact address and header
        const serverAddress = addressFactory.createAddress('sip:' + host)
        const serverContactHeader = headerFactory.createContactHeader(serverAddress)

        // This will not scale if we have a lot of DIDs
        for (var did of resourcesAPI.getDIDs()) {
            const route = {
                isLinkAOR: true,
                aorLink: did.spec.location.aorLink
            }

            locationService.addLocation(did.spec.location.telUri, route)
        }

        for (var domain of resourcesAPI.getDomains()) {
            if (domain.spec.context.egressPolicy == undefined) return

            // Get DID and GW info
            const did = resourcesAPI.findDIDByRef(domain.spec.context.egressPolicy.didRef)
            const gw = resourcesAPI.findGatewayByRef(did.metadata.gwRef)
            const gwHost = gw.spec.regService.host
            const gwUsername = gw.spec.regService.username
            const egressRule = domain.spec.context.egressPolicy.rule

            const route = {
                isLinkAOR: false,
                thruGW: true,
                rule: egressRule,
                gwUsername: gwUsername,
                gwHost: gwHost,
                did: did.spec.location.telUri,
                contactURI: addressFactory.createSipURI(egressRule, gwHost)
            }

            const address = 'sip:' + egressRule + '@' + domain.spec.context.domainUri
            locationService.addLocation(address, route)
        }

        const processor = new Processor(sipProvider, headerFactory, messageFactory, addressFactory, serverContactHeader,
            locationService, registrarService, accountManagerService, resourcesAPI, contextStorage)

        sipProvider.addSipListener(processor.listener)

        const registerHelper = new RegistryHelper(sipProvider, headerFactory, messageFactory, addressFactory)

        var registerTask = new java.util.TimerTask() {
            run: function() {
                const gateways = resourcesAPI.getGateways()

                if (gateways == null) return

                for (var gateway of gateways) {
                    LOG.debug('Register with ' + gateway.metadata.name +  ' using '
                        + gateway.spec.regService.username + '@' + gateway.spec.regService.host)

                    if (gateway.spec.regService.host !== undefined) registerHelper.requestChallenge(gateway.spec.regService.username,
                        gateway.spec.regService.host, gateway.spec.regService.transport)

                    if (gateway.spec.regService.registries === undefined) continue

                    for (var h of gateway.spec.regService.registries) {
                        LOG.debug('Register with ' + gateway.metadata.name +  ' using '  + gateway.spec.regService.username + '@' + h)

                        registerHelper.requestChallenge(gateway.spec.regService.username, h, gateway.spec.regService.transport)
                    }
                }
           }
        }

        new java.util.Timer().schedule(registerTask, 5000, proRegExp * 60 * 1000);

        restService = new RestService(this, locationService, resourcesAPI)
        restService.start()
    }

    this.stop = () => {
        LOG.info('Stopping server')
        restService.stop()
        sipStack.stop()
        exit(0)
    }
}

/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/core/resources.js')
load('mod/core/processor.js')
load('mod/core/registry_helper.js')
load('mod/rest/rest.js')

function Server(locationService, registrarService, accountManagerService, config,
    getGateways = getGatewaysFromConfig,
    getPeers = getPeersFromConfig,
    getDIDs = getDIDsFromConfig,
    getAgents = getAgentsFromConfig,
    getDomains = getDomainsFromConfig) {

    const SipFactory = Packages.javax.sip.SipFactory
    const Properties = Packages.java.util.Properties
    const LogManager = Packages.org.apache.logging.log4j.LogManager
    const LOG = LogManager.getLogger()
    let restService
    let sipStack

    // Registration with gateways expire in 5 minutes, so we will re-register in 4
    const proRegExp = 4

    this.start = () => {
        LOG.info("Starting Sip I/O on port " + config.port + " and protocol " + config.proto)

        const gateways = getGateways()
        const dids = getDIDs()
        const peers = getPeers()
        const domains = getDomains()
        const agents = getAgents()
        const properties = new Properties()
        const sipFactory = SipFactory.getInstance()

        sipFactory.setPathName("gov.nist")
        properties.setProperty("javax.sip.STACK_NAME", "fonoster")
        properties.setProperty("javax.sip.AUTOMATIC_DIALOG_SUPPORT", "OFF")
        // Guard against denial of service attack.
        properties.setProperty("gov.nist.javax.sip.MAX_MESSAGE_SIZE", "1048576");
        // Drop the client connection after we are done with the transaction.
        properties.setProperty("gov.nist.javax.sip.CACHE_CLIENT_CONNECTIONS", "false");
        properties.setProperty("gov.nist.javax.sip.TRACE_LEVEL", config.traceLevel);

        sipStack = sipFactory.createSipStack(properties)

        const messageFactory = sipFactory.createMessageFactory()
        const headerFactory = sipFactory.createHeaderFactory()
        const addressFactory = sipFactory.createAddressFactory()
        const listeningPoint = sipStack.createListeningPoint(config.ip, config.port, config.proto)
        const sipProvider = sipStack.createSipProvider(listeningPoint)

        // Server's contact address and header
        const contactAddress = addressFactory.createAddress("sip:" + config.ip + ":" + config.port)
        const contactHeader = headerFactory.createContactHeader(contactAddress)

        // This will not scale if we have a lot of DIDs
        for (var did of dids) {
            const k = "sip:" + did.e164num + "@" + config.ip + ":" + config.port

            const ca = addressFactory.createAddress(did.contact)
            const ch = headerFactory.createContactHeader(ca)
            locationService.put(k, ch.getAddress().getURI())
        }

        const processor = new Processor(sipProvider, sipStack, headerFactory, messageFactory, addressFactory, contactHeader,
            locationService, registrarService, accountManagerService, getDomains, config)

        sipProvider.addSipListener(processor.listener)

        const registerUtil = new RegistryUtil(sipProvider, headerFactory, messageFactory, addressFactory, contactHeader,
            config)

        var registerTask = new java.util.TimerTask() {
            run: function() {
                const gateways = getGateways()
                for (var gateway of gateways) {
                    LOG.debug('Register in [' + gateway.metadata.name +  '] using ['  + gateway.username + "@" + gateway.host + ']')
                    if (gateway.host !== undefined) registerUtil.requestChallenge(gateway.username, gateway.host)
                    if (gateway.registries === undefined) continue

                    for (var h of gateway.registries) {
                        LOG.debug('Register in [' + gateway.metadata.name +  '] using ['  + gateway.username + "@" + h + ']')

                        registerUtil.requestChallenge(gateway.username, h)
                    }
                }
           }
        }

        new java.util.Timer().schedule(registerTask, 5000, proRegExp * 60 * 1000);

        restService = new RestService(this, locationService, gateways, dids, domains, agents, peers, config)
        restService.start()
    }

    this.stop = () => {
        LOG.info('Stopping server')
        restService.stop()
        sipStack.stop()
        exit(0)
    }
}

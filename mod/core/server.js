// Define imports
var InetAddress     = Java.type('java.net.InetAddress')
var SipFactory      = Java.type('javax.sip.SipFactory')              // Used to access the SIP API.
var SipStack        = Java.type('javax.sip.SipStack')                // The SIP stack.
var SipProvider     = Java.type('javax.sip.SipProvider')             // Used to send SIP messages.
var MessageFactory  = Java.type('javax.sip.message.MessageFactory')  // Used to create SIP message factory.
var HeaderFactory   = Java.type('javax.sip.header.HeaderFactory')    // Used to create SIP headers.
var AddressFactory  = Java.type('javax.sip.address.AddressFactory')  // Used to create SIP URIs.
var ListeningPoint  = Java.type('javax.sip.ListeningPoint')          // SIP listening IP address/port.
var Properties      = Java.type('java.util.Properties')              // Other properties.
var LogManager      = Java.type('org.apache.logging.log4j.LogManager')

load('mod/core/processor.js')
load('mod/core/registry_helper.js')

function getPeersFromConfig() {
    return new YamlToJsonConverter().getJson('config/peers.yml')
}

function Server(locationService, registrarService, accountManagerService, config, getPeers = getPeersFromConfig) {
    let LOG = LogManager.getLogger()
    const peerRegExp = 10 // minutes

    this.start = function() {
        LOG.info("Starting Sip I/O on port " + config.port + " and protocol " + config.proto)

        let properties = new Properties()
        let sipFactory = SipFactory.getInstance()
        let contactAddress
        let contactHeader

        sipFactory.setPathName("gov.nist")
        properties.setProperty("javax.sip.STACK_NAME", "fonoster")
        properties.setProperty("javax.sip.AUTOMATIC_DIALOG_SUPPORT", "OFF")
        // Guard against denial of service attack.
        properties.setProperty("gov.nist.javax.sip.MAX_MESSAGE_SIZE", "1048576");
        // Drop the client connection after we are done with the transaction.
        properties.setProperty("gov.nist.javax.sip.CACHE_CLIENT_CONNECTIONS", "false");
        properties.setProperty("gov.nist.javax.sip.TRACE_LEVEL", config.traceLevel);

        let sipStack = sipFactory.createSipStack(properties)
        let messageFactory = sipFactory.createMessageFactory()
        let headerFactory = sipFactory.createHeaderFactory()
        let addressFactory = sipFactory.createAddressFactory()
        let listeningPoint = sipStack.createListeningPoint(config.ip, config.port, config.proto)
        let sipProvider = sipStack.createSipProvider(listeningPoint)

        // Server's contact address and header
        contactAddress = addressFactory.createAddress("sip:" + config.ip + ":" + config.port)
        contactHeader = headerFactory.createContactHeader(contactAddress)

        let processor = new Processor(sipProvider, sipStack, headerFactory, messageFactory, addressFactory, contactHeader,
            locationService, registrarService, accountManagerService, config)

        sipProvider.addSipListener(processor.listener)

        let registerUtil = new RegistryUtil(sipProvider, headerFactory, messageFactory, addressFactory, contactHeader,
            config)

        var registerTask = new java.util.TimerTask() {
            run: function() {
                let peers = getPeers()

                for (var peer of peers) {
                    LOG.info("Request registration to '" + peer.host + "' for user '" + peer.username + "'")
                    if (peer.host !== undefined) registerUtil.requestChallenge(peer.username, peer.host)
                    if (peer.registries === undefined) continue

                    for (var host of peer.registries) {
                        registerUtil.requestChallenge(peer.username, host)
                    }
                }
           }
        }

        new java.util.Timer().schedule(registerTask, 5000, peerRegExp * 60 * 1000);
    }
}



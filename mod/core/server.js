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

function Server(port = 5070,
    proto = 'udp',
    locationService,
    registrarService,
    traceLevel = 0) {
    let LOG = LogManager.getLogger()

    this.start = function() {
        LOG.info("Starting server on port " + port + " and protocol " + proto)
        let config = {port, proto}
        let ip = InetAddress.getLocalHost().getHostAddress()
        let properties = new Properties()
        let sipFactory = SipFactory.getInstance()
        let contactAddress
        let contactHeader

        sipFactory.setPathName("gov.nist")
        properties.setProperty("javax.sip.STACK_NAME", "fonoster")
        properties.setProperty("javax.sip.AUTHOMATIC_DIALOG_SUPPORT", "OFF")
        // Guard against denial of service attack.
        properties.setProperty("gov.nist.javax.sip.MAX_MESSAGE_SIZE", "1048576");
        // Drop the client connection after we are done with the transaction.
        properties.setProperty("gov.nist.javax.sip.CACHE_CLIENT_CONNECTIONS", "false");
        properties.setProperty("gov.nist.javax.sip.TRACE_LEVEL", traceLevel);

        let sipStack = sipFactory.createSipStack(properties)
        let messageFactory = sipFactory.createMessageFactory()
        let headerFactory = sipFactory.createHeaderFactory()
        let addressFactory = sipFactory.createAddressFactory()
        let listeningPoint = sipStack.createListeningPoint(ip, port, proto)
        let sipProvider = sipStack.createSipProvider(listeningPoint)
        let processor = new Processor(sipProvider,
            headerFactory,
            messageFactory,
            locationService,
            registrarService,
            config)

        sipProvider.addSipListener(processor.listener)

        contactAddress = addressFactory.createAddress("sip:" + ip + ":" + port)
        contactHeader = headerFactory.createContactHeader(contactAddress)
    }
}

/**
 * @author Pedro Sanders
 * @since v1
 */

function Originate(sipProvider, headerFactory, messageFactory, addressFactory, contextStorage, config) {
    const LogManager = Packages.org.apache.logging.log4j.LogManager
    const LOG = LogManager.getLogger()
    const SipUtils = Packages.gov.nist.javax.sip.Utils
    const Request = Packages.javax.sip.message.Request

    var cseq = 0

    this.call = (from, to, contact) => {
        const transport = 'udp'
        const port = sipProvider.getListeningPoint(transport).getPort()

        try {
            cseq++;

            const current_process = cseq + ' ' + Request.INVITE
            let viaHeaders = []
            const viaHeader = headerFactory.createViaHeader(config.ip, port, transport, null)
            viaHeaders.push(viaHeader)

            // The "Max-Forwards" header.
            const maxForwardsHeader = headerFactory.createMaxForwardsHeader(70)
            // The "Call-Id" header.
            const callIdHeader = sipProvider.getNewCallId()
            // The "CSeq" header.
            const cSeqHeader = headerFactory.createCSeqHeader(cseq, Request.INVITE)
            const fromAddress = addressFactory.createAddress(from)
            const toAddress = addressFactory.createAddress(to)
            const fromHeader = headerFactory.createFromHeader(fromAddress, new SipUtils().generateTag())
            // The "To" header.
            const toHeader = headerFactory.createToHeader(toAddress, null)
            const contentLength = headerFactory.createContentLengthHeader(300)
            const contentType = headerFactory.createContentTypeHeader('application', 'sdp')
            const contactAddress = addressFactory.createAddress(contact)
            const contactHeader = headerFactory.createContactHeader(contactAddress)

            const sdpData = 'v=0\n' +
                'o=user1 392867480 292042336 IN IP4 10.0.0.5\n' +
                's=-\n' +
                'c=IN IP4 10.0.0.5\n' +
                't=0 0\n' +
                'm=audio 8000 RTP/AVP 0 8 101\n' +
                'a=rtpmap:0 PCMU/8000\n' +
                'a=rtpmap:8 PCMA/8000\n' +
                'a=rtpmap:101 telephone-event/8000\n' +
                'a=sendrecv';

            const contents = sdpData.getBytes()

            let request = messageFactory.createRequest(Request.INVITE + ' sip:10.0.0.3 SIP/2.0\r\n\r\n')
            request.addHeader(viaHeader)
            request.addHeader(maxForwardsHeader)
            request.addHeader(toHeader)
            request.addHeader(fromHeader)
            request.addHeader(callIdHeader)
            request.addHeader(cSeqHeader)
            request.addHeader(contactHeader)
            request.addHeader(contentLength)
            request.addHeader(contentType)
            request.setContent(contents, contentType)

            const clientTransaction = sipProvider.getNewClientTransaction(request)
            clientTransaction.sendRequest()

            // Transaction context
            const context = new Context()
            context.clientTransaction = clientTransaction
            context.method = Request.INVITE
            context.requestIn = request
            context.requestOut = request
            contextStorage.saveContext(context)

            LOG.trace(request)
        } catch (e) {
            e.printStackTrace()
            LOG.warn(e.getMessage())
        }
    }
}


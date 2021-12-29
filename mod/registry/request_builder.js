/**
 * @author Pedro Sanders
 * @since v1
 *
 * Request build for the Registry module
 */
module.exports = (
  gateway,
  contactAddr,
  viaAddr,
  callId,
  cseq,
  userAgent,
  buildAddr,
  exp
) => {
  const SipUtils = Java.type('gov.nist.javax.sip.Utils')
  const Request = Java.type('javax.sip.message.Request')
  const SipFactory = Java.type('javax.sip.SipFactory')
  const messageFactory = SipFactory.getInstance().createMessageFactory()
  const headerFactory = SipFactory.getInstance().createHeaderFactory()
  const addressFactory = SipFactory.getInstance().createAddressFactory()

  // Gw info
  const username = gateway.spec.credentials.username
  const gwHost = buildAddr(gateway.spec.host, gateway.spec.port)
  const gwRef = gateway.metadata.ref
  const transport = gateway.spec.transport
  let expires = exp ? exp : gateway.spec.expires
  expires = expires ? expires : 3600

  const fromAddress = addressFactory.createAddress(`sip:${username}@${gwHost}`)
  const contactAddress = addressFactory.createAddress(
    `sip:${username}@${contactAddr.host}:${
      contactAddr.port
    };transport=${transport};bnc`
  )
  const viaHeader = headerFactory.createViaHeader(
    viaAddr.host,
    viaAddr.port,
    transport,
    null
  )
  viaHeader.setRPort()

  const headers = []
  headers.push(viaHeader)
  headers.push(callId)
  headers.push(headerFactory.createProxyRequireHeader('gin'))
  headers.push(headerFactory.createRequireHeader('gin'))
  headers.push(headerFactory.createExpiresHeader(expires))
  headers.push(headerFactory.createMaxForwardsHeader(70))
  headers.push(headerFactory.createCSeqHeader(cseq, Request.REGISTER))
  headers.push(
    headerFactory.createFromHeader(fromAddress, new SipUtils().generateTag())
  )
  headers.push(headerFactory.createToHeader(fromAddress, null))
  headers.push(headerFactory.createContactHeader(contactAddress))
  headers.push(headerFactory.createUserAgentHeader([userAgent]))
  headers.push(headerFactory.createAllowHeader('INVITE'))
  headers.push(headerFactory.createAllowHeader('ACK'))
  headers.push(headerFactory.createAllowHeader('BYE'))
  headers.push(headerFactory.createAllowHeader('CANCEL'))
  headers.push(headerFactory.createAllowHeader('REGISTER'))
  headers.push(headerFactory.createAllowHeader('OPTIONS'))
  headers.push(headerFactory.createSupportedHeader('path'))
  headers.push(headerFactory.createHeader('X-Gateway-Ref', gwRef))

  const request = messageFactory.createRequest(
    `REGISTER sip:${gwHost};transport=${transport} SIP/2.0\r\n\r\n`
  )
  headers.forEach(header => request.addHeader(header))

  return request
}

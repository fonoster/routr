/**
 * @author Pedro Sanders
 * @since v1
 */
const { RTPBridgingNote } = require('@routr/rtpengine/rtp_bridging_note')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const isTransportWeb = t => t === 'ws' || t === 'wss'

module.exports.getBridgingNote = (request, route) => {
  const destTransport = route.transport.toLowerCase()
  const srcTransport = request
    .getHeader(ViaHeader.NAME)
    .getTransport()
    .toLowerCase()
  if (isTransportWeb(srcTransport) && isTransportWeb(destTransport))
    return RTPBridgingNote.WEB_TO_WEB
  if (isTransportWeb(srcTransport) && !isTransportWeb(destTransport))
    return RTPBridgingNote.WEB_TO_SIP
  if (!isTransportWeb(srcTransport) && !isTransportWeb(destTransport))
    return RTPBridgingNote.SIP_TO_SIP
  if (!isTransportWeb(srcTransport) && isTransportWeb(destTransport))
    return RTPBridgingNote.SIP_TO_WEB
}

/**
 * @author Pedro Sanders
 * @since v1
 */
const { RTPBridgingNote } = require('@routr/rtpengine/rtp_bridging_note')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const bencode = require('bencode')
const isTransportWeb = t => t === 'ws' || t === 'wss'
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

module.exports.directionFromRequest = (request, route) => {
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

module.exports.directionFromResponse = response => {
  const viaHeaders = response.getHeaders(ViaHeader.NAME)
  if (viaHeaders.hasNext()) {
    const viaHeaders = response.getHeaders(ViaHeader.NAME)
    const srcTransport = viaHeaders
      .next()
      .getTransport()
      .toLowerCase()
    const destTransport = viaHeaders
      .next()
      .getTransport()
      .toLowerCase()

    if (isTransportWeb(srcTransport) && isTransportWeb(destTransport))
      return RTPBridgingNote.WEB_TO_WEB

    if (isTransportWeb(srcTransport) && !isTransportWeb(destTransport))
      return RTPBridgingNote.SIP_TO_WEB

    if (!isTransportWeb(srcTransport) && isTransportWeb(destTransport))
      return RTPBridgingNote.WEB_TO_SIP
  }

  return RTPBridgingNote.SIP_TO_SIP
}

module.exports.benDecode = msg => {
  const m = msg.toString()
  const idx = m.indexOf(' ')

  if (-1 !== idx) {
    const id = m.substring(0, idx)
    try {
      const data = bencode.decode(Buffer.from(m.substring(idx + 1)), 'utf-8')
      return { id, data }
    } catch (err) {
      LOG.error(err)
    }
  }
}

module.exports.benEncode = (id, data) =>
  Buffer.from([id, bencode.encode(data)].join(' '))

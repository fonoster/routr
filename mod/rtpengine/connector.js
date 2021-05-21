/**
 * Manage RTPEngine bindings
 *
 * @author Pedro Sanders
 * @since v1
 */
const merge = require('deepmerge')
const { RTPBridgingNote } = require('@routr/rtpengine/rtp_bridging_note')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()
const NGHttpSender = require('./ng_http_sender')

class RTPEngineConnector {
  constructor (config) {
    LOG.debug(`rtpengine.RTPEngineConnector connector is up`)
    this.sender = new NGHttpSender(
      `${config.proto}://${config.host}:${config.port}/ng`
    )
    this.bridgeParams = config.bridgeParams
  }

  getBridgingInfo (bridgingNote, offer = true) {
    const bridgeParams = this.bridgeParams
    switch (bridgingNote) {
      case RTPBridgingNote.WEB_TO_WEB:
        return bridgeParams.webToWeb
      case RTPBridgingNote.WEB_TO_SIP:
        return offer ? bridgeParams.webToSip : bridgeParams.sipToWeb
      case RTPBridgingNote.SIP_TO_WEB:
        return offer ? bridgeParams.sipToWeb : bridgeParams.webToSip
      default:
        return bridgeParams.sipToSip
    }
  }

  async delete (callId, fromTag) {
    return await this.sender.sendCmd('delete', {
      'call-id': callId,
      'from-tag': fromTag
    })
  }

  async offer (bridgingNote, params) {
    LOG.debug(
      `rtpengine.RTPEngineConnector.offer [bridging note: ${bridgingNote}]`
    )
    const p = merge(params, this.getBridgingInfo(bridgingNote, true))
    const obj = await this.sender.sendCmd('offer', p)

    // WARNING: This patches an issue with RTPEngine where its not setting rtpmux
    if (
      bridgingNote === RTPBridgingNote.WEB_TO_WEB ||
      bridgingNote === RTPBridgingNote.SIP_TO_WEB
    ) {
      obj.sdp = obj.sdp
        .replaceAll('a=crypto:', 'a=ignore:')
        .replaceAll('a=sendrecv', 'a=sendrecv\na=rtcp-mux')
    }

    LOG.debug(
      `rtpengine.RTPEngineConnector.offer [obj => ${JSON.stringify(obj)}]`
    )

    return obj
  }

  async answer (bridgingNote, params) {
    LOG.debug(
      `rtpengine.RTPEngineConnector.answer [bridging note: ${bridgingNote}]`
    )
    const p = merge(params, this.getBridgingInfo(bridgingNote, false))
    const obj = await this.sender.sendCmd('answer', p)

    LOG.debug(
      `rtpengine.RTPEngineConnector.answer [obj => ${JSON.stringify(obj)}]`
    )

    // WARNING: This patches an issue with RTPEngine where its not setting rtpmux
    if (bridgingNote === RTPBridgingNote.WEB_TO_SIP) {
      obj.sdp = obj.sdp.replace('a=setup:active', 'a=setup:active\na=rtcp-mux')
    }

    return obj
  }
}

module.exports = RTPEngineConnector

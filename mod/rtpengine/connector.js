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
const postal = require('postal')

class RTPEngineConnector {
  constructor (config) {
    LOG.debug(`rtpengine.RTPEngineConnector connector is up`)

    // This shouldn't be need because there is no dialog stablish
    // The call will be removed afeter a timeout
    /*postal.subscribe({
      channel: 'processor',
      topic: 'transaction.cancel',
      callback: async(data) => {
        await this.delete(data.callId, data.fromTag)
      }
    })*/
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
    return await this.sender.sendCmd('offer', p)
  }

  async answer (bridgingNote, params) {
    LOG.debug(
      `rtpengine.RTPEngineConnector.answer [bridging note: ${bridgingNote}]`
    )
    const p = merge(params, this.getBridgingInfo(bridgingNote, false))
    return await this.sender.sendCmd('answer', p)
  }
}

module.exports = RTPEngineConnector

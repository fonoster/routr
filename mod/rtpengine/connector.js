/**
 * Manage RTPEngine bindings
 *
 * @author Pedro Sanders
 * @since v1
 */
const merge = require('deepmerge')
const postal = require('postal')
const config = require('@routr/core/config_util')()
const RTPBridgingNote = require('@routr/rtpengine/rtp_bridging_note')

const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()
const Unirest = Java.type('com.mashape.unirest.http.Unirest')
const rtpeBaseUrl = `http://${config.spec.ex_mediaEngine.host}:${
  config.spec.ex_mediaEngine.port
}/api`

const webToSip = {
  'transport protocol': 'RTP/AVP',
  'rtcp-mux': 'demux',
  ICE: 'remove',
  DTLS: 'off',
  SDES: 'off'
}

const sipToWeb = {
  'transport protocol': 'RTP/SAVPF',
  'rtcp-mux': 'offer',
  ICE: 'force',
  DTLS: 'active',
  SDES: 'off',
  flags: 'generate mid'
}

class RTPEngineConnector {
  constructor () {
    LOG.debug(`rtpengine.RTPEngineConnector connector is up`)

    // This is not a good criteria to delete the binding.
    // It should happend on a Bye or Cancel or Timeout
    /*postal.subscribe({
      channel: 'processor',
      topic: 'transaction.terminated',
      callback: data => this.deleteCallBinding(data.callId, data.fromTag)
    })*/
  }

  deleteCallBinding (callId, fromTag) {
    return RTPEngineConnector.sendCmd(`delete/${callId}`, {
      'call-id': callId,
      'from-tag': fromTag
    })
  }

  static async offer (bridgingNote, params) {
    LOG.debug(
      `rtpengine.RTPEngineConnector.offer [bridging note: ${bridgingNote}]`
    )
    if (bridgingNote === RTPBridgingNote.WEB_TO_SIP) {
      merge(params, webToSip)
    } else if (bridgingNote === RTPBridgingNote.SIP_TO_WEB) {
      merge(params, sipToWeb)
    }

    return await RTPEngineConnector.sendCmd('offer', params)
  }

  static async answer (bridgingNote, params) {
    LOG.debug(
      `rtpengine.RTPEngineConnector.answer [bridging note: ${bridgingNote}]`
    )
    if (bridgingNote === RTPBridgingNote.SIP_TO_WEB) {
      merge(params, webToSip)
    } else if (bridgingNote === RTPBridgingNote.WEB_TO_SIP) {
      merge(params, sipToWeb)
    }

    return await RTPEngineConnector.sendCmd('answer', params)
  }

  static async sendCmd (cmd, params) {
    try {
      LOG.debug(
        `rtpengine.RTPEngineConnector.${cmd} [call-id: ${params['call-id']}]`
      )

      const res = await Unirest.post(`${rtpeBaseUrl}/${cmd}`)
        .header('Content-Type', 'application/json')
        .body(JSON.stringify(params))
        .asString()
      return JSON.parse(res.getBody())
    } catch (e) {
      LOG.error(e)
    }
  }
}

module.exports = RTPEngineConnector

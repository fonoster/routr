/**
 * Manage RTPEngine bindings
 *
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')
const config = require('@routr/core/config_util')()

const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()
const Unirest = Java.type('com.mashape.unirest.http.Unirest')
const rtpeBaseUrl = `http://${config.spec.ex_mediaEngine.host}:${
  config.spec.ex_mediaEngine.port
}/api`

class RTPEngineConnector {
  constructor () {
    LOG.debug(`rtpengine.RTPEngineConnector connector is up`)
    postal.subscribe({
      channel: 'processor',
      topic: 'transaction.terminated',
      callback: data => this.deleteCallBinding(data.callId, data.fromTag)
    })
  }

  deleteCallBinding (callId, fromTag) {
    return RTPEngineConnector.sendCmd(
      `delete/${callId}`,
      JSON.stringify({
        'call-id': callId,
        'from-tag': fromTag
      })
    )
  }

  static async offer (params) {
    return await RTPEngineConnector.sendCmd('offer', params)
  }

  static async answer (params) {
    return await RTPEngineConnector.sendCmd('answer', params)
  }

  static async sendCmd (cmd, params) {
    try {
      LOG.debug(
        `rtpengine.RTPEngineConnector.${cmd} [call-id: ${params['call-id']}]`
      )
      console.log(`xxxx => ${rtpeBaseUrl}/${cmd}`)

      const res = await Unirest.post(`${rtpeBaseUrl}/${cmd}`)
        .header('Content-Type', 'application/json')
        .body(JSON.stringify(params))
        .asString()
      return JSON.parse(res.getBody())
    } catch (e) {
      console.log(e)
    }
  }
}

module.exports = RTPEngineConnector

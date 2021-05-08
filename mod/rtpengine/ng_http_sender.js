const Unirest = Java.type('com.mashape.unirest.http.Unirest')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()
const { benEncode, benDecode } = require('./utils')

let cnt = 0

class NGHttpSender {
  constructor (baseUrl) {
    this.baseUrl = baseUrl
  }

  async sendCmd (cmd, params) {
    try {
      LOG.debug(
        `NGHttpSender.sendCmd cmd-${cmd} [call-id: ${params['call-id']}]`
      )

      params.command = cmd

      // The bencode id must be unique. So we add this value to avoid collition
      cnt++

      const res = await Unirest.post(`${this.baseUrl}`)
        .header('Content-Type', 'application/x-rtpengine-ng')
        .body(benEncode(params['call-id'] + cnt, params))
        .asString()

      const data = benDecode(res.getBody()).data

      LOG.debug(
        `NGHttpSender.sendCmd cmd-${cmd} [results ${JSON.stringify(data)}]`
      )

      return data
    } catch (e) {
      LOG.error(e)
    }
  }
}

module.exports = NGHttpSender

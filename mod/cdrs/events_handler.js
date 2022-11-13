/**
 * Stores in memory information about sip transactions.
 *
 * @author Pedro Sanders
 * @since v1
 */
const config = require('@routr/core/config_util')()
const postal = require('postal')
const KafkaSender = require('./kafka_cdrs_sender')
const { sendCallRecordToFluent } = require('./fluent_cdrs_sender')

class EventsHandler {
  constructor () {
    postal.subscribe({
      channel: 'cdrs',
      topic: 'cdr.started',
      callback: data => this.processEvent(data.cdr)
    })

    postal.subscribe({
      channel: 'cdrs',
      topic: 'cdr.complete',
      callback: data => this.processEvent(data.cdr)
    })

    if (config.spec.ex_kafka?.enabled) {
      this.kafkaSender = new KafkaSender()
    }
  }

  processEvent (cdr) {
    if (config.spec.ex_kafka?.enabled) {
      this.kafkaSender.sendCallRecord(JSON.stringify(cdr))
    }

    // We need to send full CDRs to Fluentd
    if (cdr.endTime) {
      sendCallRecordToFluent(cdr)
    }
  }
}

module.exports = EventsHandler

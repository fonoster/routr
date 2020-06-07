/**
 * Experimental feature to provide event publication to a broker like Kafka.
 *
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')
const KafkaPublisher = Java.type('io.routr.kafka.KafkaPublisher')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

class Publisher {
  constructor (broker, topic) {
    this.kafkaPublisher = new KafkaPublisher(broker, topic)
  }

  publish (data) {
    this.kafkaPublisher.publish(JSON.stringify(data))
  }

  init () {
    postal.subscribe({
      channel: 'locator',
      topic: 'endpoint.add',
      callback: data => this.publish(data)
    })
  }
}

module.exports = Publisher

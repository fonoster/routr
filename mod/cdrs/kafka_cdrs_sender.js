/**
 * @author Pedro Sanders
 * @since v1
 */
const config = require('@routr/core/config_util')()
const KafkaProducer = Java.type(
  'org.apache.kafka.clients.producer.KafkaProducer'
)
const ProducerRecord = Java.type(
  'org.apache.kafka.clients.producer.ProducerRecord'
)
const StringSerializer = Java.type(
  'org.apache.kafka.common.serialization.StringSerializer'
).class.canonicalName
const Properties = Java.type('java.util.Properties')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger(Java.type('io.routr.core.Launcher'))

class CDRSender {
  constructor () {
    const kafkaConfig = config.spec.ex_kafka
    const properties = new Properties()
    properties.setProperty('bootstrap.servers', kafkaConfig.bootstrapServers)
    properties.setProperty('security.protocol', kafkaConfig.securityProtocol)
    properties.setProperty('sasl.mechanism', kafkaConfig.saslMechanism)
    properties.setProperty('sasl.jaas.config', kafkaConfig.saslJaasConfig)
    properties.setProperty('key.serializer', StringSerializer)
    properties.setProperty('value.serializer', StringSerializer)
    this.producer = new KafkaProducer(properties)
    this.topic = kafkaConfig.topic
  }

  sendCallRecord (callRecord, isCallEnd) {
    const record = new ProducerRecord(this.topic, callRecord)
    if (isCallEnd) {
      record.headers().add('MessageType', 'CallEnd'.getBytes());
    } else {
      record.headers().add('MessageType', 'CallStart'.getBytes());
    }
    this.producer.send(record)
  }
}

module.exports = CDRSender

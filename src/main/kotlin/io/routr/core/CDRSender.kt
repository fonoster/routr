package io.routr.core

import org.apache.kafka.clients.producer.KafkaProducer
import org.apache.kafka.clients.producer.Producer
import org.apache.kafka.clients.producer.ProducerRecord
import org.apache.kafka.common.serialization.StringSerializer
import java.util.*

/**
 * @author Pedro Sanders
 * @since v1
 */
class CDRSender {
  private val producer = createProducer()

  fun sendCallRecord(callRecord: String) {
    val topic = System.getenv("EX_KAFKA_TOPIC") ?: "cdrs"
    val futureResult = producer.send(ProducerRecord(topic, callRecord))
    // wait for the write acknowledgment
    futureResult.get()
  }

  private fun createProducer(): Producer<String, String> {
    val props = Properties()
    // Read variable from environment
    props["bootstrap.servers"] = System.getenv("EX_KAFKA_BOOTSTRAP_SERVERS")
    props["security.protocol"] = System.getenv("EX_KAFKA_SECURITY_PROTOCOL")
    props["sasl.mechanism"] = System.getenv("EX_KAFKA_SASL_MECHANISM")
    props["sasl.jaas.config"] = System.getenv("EX_KAFKA_SASL_JAAS_CONFIG")
    props["key.serializer"] = StringSerializer::class.java.canonicalName
    props["value.serializer"] = StringSerializer::class.java.canonicalName
    return KafkaProducer<String, String>(props)
  }
}

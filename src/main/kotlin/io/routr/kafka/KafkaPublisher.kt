package io.routr.kafka

import io.routr.kafka.Event
import io.routr.kafka.jsonMapper

import org.apache.kafka.clients.producer.KafkaProducer
import org.apache.kafka.clients.producer.Producer
import org.apache.kafka.clients.producer.ProducerRecord
import org.apache.kafka.common.serialization.StringSerializer
import org.apache.log4j.LogManager
import java.util.*

class KafkaPublisher(brokers: String, topic: String) {

    private val logger = LogManager.getLogger(javaClass)
    private val producer = createProducer(brokers)
    private val topic = topic

    private fun createProducer(brokers: String): Producer<String, String> {
        logger.debug("Initialized producer")
        val props = Properties()
        props["bootstrap.servers"] = brokers
        props["key.serializer"] = StringSerializer::class.java
        props["value.serializer"] = StringSerializer::class.java
        return KafkaProducer<String, String>(props)
    }

    fun publish(data: String) {
        val event = Event(
          data = data
        )
        val eventJson = jsonMapper.writeValueAsString(event)
        val futureResult = producer.send(ProducerRecord(topic, eventJson))
        // wait for the write acknowledgment
        futureResult.get()
    }
}

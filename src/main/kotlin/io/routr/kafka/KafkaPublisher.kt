package io.routr.kafka

import io.routr.kafka.Event
import io.routr.kafka.jsonMapper

import kotlinx.coroutines.*
import org.apache.kafka.clients.producer.KafkaProducer
import org.apache.kafka.clients.producer.Producer
import org.apache.kafka.clients.producer.ProducerRecord
import org.apache.kafka.common.serialization.StringSerializer
import java.util.concurrent.ExecutionException
import org.apache.logging.log4j.LogManager
import java.util.*

class KafkaPublisher(brokers: String, topic: String) {
    private val LOG = LogManager.getLogger()
    private val producer = createProducer(brokers)
    private val topic = topic
    private val brokers = brokers

    private fun createProducer(brokers: String): Producer<String, String> {
        val props = Properties()
        props["bootstrap.servers"] = brokers
        props["key.serializer"] = StringSerializer::class.java
        props["value.serializer"] = StringSerializer::class.java
        return KafkaProducer<String, String>(props)
    }

    fun publish(data: String) {
        GlobalScope.launch {
          val event = Event(
            data = data
          )
          try {
            val eventJson = jsonMapper.writeValueAsString(event)
            val futureResult = producer.send(ProducerRecord(topic, eventJson))
            // wait for the write acknowledgment
            futureResult.get()
          } catch(e: ExecutionException) {
            LOG.error("Unable to publish message [brokers: ${brokers}, topic: ${topic}] ")
          }
        }
    }
}

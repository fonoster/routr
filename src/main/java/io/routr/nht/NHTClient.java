package io.routr.nht;

import java.io.Serializable;
import javax.jms.*;

import org.apache.activemq.ActiveMQConnectionFactory;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import it.unimi.dsi.util.XoRoShiRo128PlusRandom;

/**
 * @author Pedro Sanders
 * @since v1
 */
public class NHTClient {
    private static int ackMode;
    private static String clientQueueName;
    private static String messageBrokerUrl;
    private static String collectionName = "default";

    private boolean transacted = false;
    private MessageProducer producer;
    private Session session;
    private Destination tempDest;
    private MessageConsumer responseConsumer;
    private static XoRoShiRo128PlusRandom random = new XoRoShiRo128PlusRandom();
    private static Logger LOG = LogManager.getLogger();

    static {
        clientQueueName = "client.messages";
        ackMode = Session.AUTO_ACKNOWLEDGE;
    }

    public NHTClient(String url) {
        ActiveMQConnectionFactory connectionFactory = new ActiveMQConnectionFactory(url);
        Connection connection;
        try {
            connection = connectionFactory.createConnection();
            connection.start();
            Session session = connection.createSession(transacted, ackMode);
            Destination adminQueue = session.createQueue(clientQueueName);

            this.producer = session.createProducer(adminQueue);
            this.producer.setDeliveryMode(DeliveryMode.NON_PERSISTENT);

            Destination tempDest = session.createTemporaryQueue();
            MessageConsumer responseConsumer = session.createConsumer(tempDest);

            this.session = session;
            this.tempDest = tempDest;
            this.responseConsumer = responseConsumer;
        } catch (JMSException e) {
            LOG.error(e);
        }
    }

    public NHTClient withCollection(String name) {
        this.collectionName = name;
        return this;
    }

    public Serializable put(Object k, Object v) throws JMSException {
        return sendCmd(this.collectionName, "PUT", k, v);
    }

    public Serializable get(Object k) throws JMSException {
        return sendCmd(this.collectionName, "GET", k, null);
    }

    public Serializable remove(Object k) throws JMSException {
        return sendCmd(this.collectionName, "REMOVE", k, null);
    }

    public Serializable list() throws JMSException {
        return sendCmd(this.collectionName, "LIST", null, null);
    }

    private Serializable sendCmd(String c, String v, Object k, Object p)
        throws JMSException {
        MapMessage message = this.session.createMapMessage();
        message.setString("COLLECTION", c);
        message.setString("VERB", v);
        message.setObject("KEY", k);
        message.setObject("VALUE", p);
        message.setJMSReplyTo(tempDest);
        message.setJMSCorrelationID("" + random.nextLong());
        this.producer.send(message);
        Message response = this.responseConsumer.receive();
        return ((ObjectMessage) response).getObject();
    }

}

package io.routr.nht;

import org.apache.activemq.broker.BrokerService;
import org.apache.activemq.ActiveMQConnectionFactory;

import java.io.Serializable;
import javax.jms.*;

public class NHTServer implements MessageListener {
    private static int ackMode;
    private static String messageQueueName;
    private static String url;

    private Session session;
    private boolean transacted = false;
    private MessageProducer replyProducer;
    private MessageProtocol messageProtocol;

    static {
        messageQueueName = "client.messages";
        ackMode = Session.AUTO_ACKNOWLEDGE;
    }

    public NHTServer(String url) {
        this.url = url;
    }

    public void start() {
        try {
            BrokerService broker = new BrokerService();
            broker.setPersistent(false);
            broker.setBrokerName("routr");
            broker.setUseJmx(false);
            broker.addConnector(this.url);
            broker.start();
        } catch (Exception e) {
            // TODO: Handle the exception appropriately
        }
        this.messageProtocol = new MessageProtocol();
        this.setupMessageQueueConsumer();
    }

    private void setupMessageQueueConsumer() {
        ActiveMQConnectionFactory connectionFactory = new ActiveMQConnectionFactory("vm://routr");
        Connection connection;
        try {
            connection = connectionFactory.createConnection();
            connection.start();
            this.session = connection.createSession(this.transacted, ackMode);
            Destination adminQueue = this.session.createQueue(messageQueueName);

            this.replyProducer = this.session.createProducer(null);
            this.replyProducer.setDeliveryMode(DeliveryMode.NON_PERSISTENT);

            MessageConsumer consumer = this.session.createConsumer(adminQueue);
            consumer.setMessageListener(this);
        } catch (JMSException e) {
            // TODO: Handle the exception appropriately
        }
    }

    public void onMessage(Message message) {
        try {
            ObjectMessage response = this.session.createObjectMessage();
            if (message instanceof MapMessage) {
                Serializable answer = this.messageProtocol.handleProtocolMessage((MapMessage) message);
                response.setObject(answer);
            }
            response.setJMSCorrelationID(message.getJMSCorrelationID());
            this.replyProducer.send(message.getJMSReplyTo(), response);
        } catch (JMSException e) {
            // TODO: Handle the exception appropriately
        }
    }

}

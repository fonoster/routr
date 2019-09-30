package io.routr.nht;

import java.util.HashMap;
import javax.jms.*;
import java.io.Serializable;

/**
 * @author Pedro Sanders
 * @since v1
 */
public class MessageProtocol {
    private HashMap collections;

    public MessageProtocol() {
        this.collections = new HashMap();
    }

    public Serializable handleProtocolMessage(MapMessage message) throws JMSException {
        String collection = message.getString("COLLECTION");

        HashMap h = (HashMap) this.collections.get(collection);
        if (h == null) {
            h = new HashMap();
            this.collections.put(collection, h);
        }

        switch (message.getString("VERB")) {
            case "PUT":
                return (Serializable) h.put(message.getObject("KEY"), message.getObject("VALUE"));
            case "GET":
                return (Serializable) h.get(message.getObject("KEY"));
            case "REMOVE":
                return (Serializable) h.remove(message.getObject("KEY"));
            case "LIST":
                return (Serializable) h.values().toArray();
            default:
                throw new RuntimeException("Invalid verb: " + message.getString("VERB"));
        }
    }
}

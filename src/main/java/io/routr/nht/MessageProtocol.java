package io.routr.nht;

import java.util.HashMap;
import javax.jms.*;
import java.io.Serializable;

public class MessageProtocol {
    private HashMap h;

    public MessageProtocol() {
        this.h = new HashMap();
    }

    public Serializable handleProtocolMessage(MapMessage message) throws JMSException {
        switch (message.getString("VERB")) {
            case "PUT":
                return (Serializable) this.h.put(message.getObject("KEY"), message.getObject("VALUE"));
            case "GET":
                return (Serializable) this.h.get(message.getObject("KEY"));
            case "REMOVE":
                return (Serializable) this.h.remove(message.getObject("KEY"));
            case "LIST":
                return (Serializable) this.h.values().toArray();
            default:
                throw new RuntimeException("Invalid verb: " + message.getString("VERB"));
        }
    }
}

package io.routr.headers;

import com.google.protobuf.Descriptors.FieldDescriptor;
import com.google.protobuf.GeneratedMessageV3;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.ListIterator;
import java.util.Map;
import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.header.CallIdHeader;
import javax.sip.header.Header;
import javax.sip.header.ViaHeader;
import javax.sip.message.Message;
import javax.sip.message.Request;
import javax.sip.message.Response;
import gov.nist.javax.sip.header.Authorization;
import gov.nist.javax.sip.header.CSeq;
import gov.nist.javax.sip.header.CallID;
import gov.nist.javax.sip.header.Expires;
import io.routr.utils.ClassFinder;
import gov.nist.javax.sip.header.Via;
import gov.nist.javax.sip.header.To;
import gov.nist.javax.sip.header.From;
import gov.nist.javax.sip.header.WWWAuthenticate;
import io.routr.message.SIPMessage.Builder;
import io.routr.message.*;
import io.routr.common.*;
import io.routr.processor.*;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public 
class MessageConverter {
  private Map<String, NetInterface> listeningPoints;
  private List<String> externalIps;
  private List<String> localnets;
  private final static Logger LOG = LogManager.getLogger(MessageConverter.class);
  private final String edgePortRef; 

  public MessageConverter(String edgePortRef) {
    this.edgePortRef = edgePortRef;
  }

  public MessageRequest createMessageRequest(final Message message) {
    String methodStr = null;
    if (message instanceof Request) {
      methodStr =  ((Request)message).getMethod();
    } else if (message instanceof Response){
      methodStr = ((CSeq) ((Response)message).getHeader(CSeq.NAME)).getMethod();
    }

    NetInterface sender = getSender(message);
    String callId = ((CallIdHeader) message.getHeader(CallIdHeader.NAME)).getCallId();
    Method method = Method.valueOf(methodStr.toUpperCase());
    NetInterface listeningPoint = this.listeningPoints.get(sender.getTransport().toString());

    return MessageRequest
        .newBuilder()
        .setRef(callId)
        .setEdgePortRef(this.edgePortRef)
        .setMethod(method)
        .setSender(sender)
        .setListeningPoint(listeningPoint)
        .addAllExternalIps(this.externalIps)
        .addAllLocalnets(this.localnets)
        .setMessage(convertToMessageDTO(message))
        .build();
  }

  static public SIPMessage convertToMessageDTO(final Message message) {
    Builder sipMessageBuilder = SIPMessage.newBuilder();

    if (message instanceof Request) {
      var sipURI = (javax.sip.address.SipURI) ((Request) message).getRequestURI();
      var converter = new SipURIConverter();
      sipMessageBuilder.setRequestUri(converter.fromObject(sipURI));
    } else if (message instanceof Response){
      Response response = (Response) message;
      sipMessageBuilder.setResponseType(
        ResponseType.valueOf(ResponseCode.fromCode(response.getStatusCode())));
    }

    // Getting a list of names of all headers present on SIP Message
    ListIterator<String> namesIterator = message.getHeaderNames();

    // Traversing elements
    while (namesIterator.hasNext()) {
      Header header = message.getHeader(namesIterator.next());
      String fieldName = header.getName().toLowerCase().replace("-", "_");
      Converter<Header, GeneratedMessageV3> converter = getConverterByHeader(header.getClass());
      ProtoMapping mapping = converter.getClass().getAnnotation(ProtoMapping.class);
      FieldDescriptor descriptor = SIPMessage.getDescriptor().findFieldByName(fieldName);

      // Takes care of headers that might appear more than once
      if (mapping.repeatable()) {
        ListIterator<Header> headers = message.getHeaders(header.getName());
        while (headers.hasNext()) {
          Header currentHeader = headers.next();
          sipMessageBuilder.addRepeatedField(descriptor, converter.fromHeader(currentHeader));
        }
        // Takes care of custom headers
      } else if (mapping.extension()) {
        FieldDescriptor extDescriptor = SIPMessage.getDescriptor().findFieldByName(mapping.field());
        sipMessageBuilder.addRepeatedField(extDescriptor, converter.fromHeader(header));
        // Everything else goes here
      } else {
        sipMessageBuilder.setField(descriptor, converter.fromHeader(header));
      }
    }
    return sipMessageBuilder.build();
  }

  static public List<Header> createHeadersFromMessage(final SIPMessage message)
      throws InvalidArgumentException, PeerUnavailableException, ParseException {
    List<Header> headers = new ArrayList<>();

    var vias = message.getViaList().listIterator(message.getViaList().size());

    while (vias.hasPrevious()) {
      io.routr.message.Via via = vias.previous();
      var converter = getConverterByHeader(Via.class);
      headers.add(converter.fromDTO(via));
    }

    if (message.hasCallId()) {
      var converter = getConverterByHeader(CallID.class);
      headers.add(converter.fromDTO(message.getCallId()));
    }

    if (message.hasWwwAuthenticate()) {
      var converter = getConverterByHeader(WWWAuthenticate.class);
      headers.add(converter.fromDTO(message.getWwwAuthenticate()));
    }

    if (message.hasAuthorization()) {
      var converter = getConverterByHeader(Authorization.class);
      headers.add(converter.fromDTO(message.getAuthorization()));
    }

    if (message.hasFrom()) {
      var converter = getConverterByHeader(From.class);
      headers.add(converter.fromDTO(message.getFrom()));
    }

    if (message.hasTo()) {
      var converter = getConverterByHeader(To.class);
      headers.add(converter.fromDTO(message.getTo()));
    }

    if (message.hasContact()) {
      var converter = getConverterByHeader(Contact.class);
      headers.add(converter.fromDTO(message.getContact()));
    }

    if (message.hasExpires()) {
      var converter = getConverterByHeader(Expires.class);
      headers.add(converter.fromDTO(message.getExpires()));
    }

    if (!message.getExtensionsList().isEmpty()) {
      var extensions = message.getExtensionsList().iterator();
      var converter = new ExtensionConverter();

      while (extensions.hasNext()) {
        io.routr.message.Extension extension = extensions.next();
        try {
          headers.add(converter.fromDTO(extension));
        } catch (Exception e) {
          LOG.warn(e.getMessage());
          // This will stop happening once we implement all of the headers
          // e.printStackTrace();
        }
      }
    }

    return headers;
  }

  static public List<NetInterface> getExternalAddresses(List<String> addrs) {
    List<NetInterface> addrsResult = new ArrayList<NetInterface>();
    Iterator<String> a = addrs.iterator();
    while (a.hasNext()) {
      String addr = a.next();
      String host = addr.split(":")[0];
      int port = addr.split(":").length == 2
          ? Integer.parseInt(addr.split(":")[1])
          : 5060;
      addrsResult.add(NetInterface
          .newBuilder()
          .setHost(host)
          .setPort(port)
          .build());
    }
    return addrsResult;
  }

  static public NetInterface getSender(final Message message) {
    // The top header belongs to the sender. This method must be called before
    // any updates is made to the request.
    ViaHeader via = (ViaHeader) message.getHeader(ViaHeader.NAME);
    return NetInterface.newBuilder()
        .setHost(via.getHost())
        .setPort(via.getPort())
        .setTransport(Transport.valueOf(via.getTransport().toUpperCase()))
        .build();
  }

  static private Converter getConverterByHeader(Class<?> clasz) {
    Class<Converter> converter = ClassFinder.findConverterByHeaderClass(clasz);
    if (converter != null) {
      try {
        return converter.getDeclaredConstructor().newInstance();
      } catch (Exception e) {
        LOG.warn(e.getMessage());
      }
    }
    return new ExtensionConverter();
  }

  public void setListeningPoints(final Map<String, NetInterface> listeningPoints) {
    this.listeningPoints = listeningPoints;
  }

  public void setExternalIps(final List<String> externalIps) {
    this.externalIps = externalIps;
  }

  public void setLocalnets(final List<String> localnets) {
    this.localnets = localnets;
  }
}
package io.routr.headers;

import com.google.protobuf.Descriptors.FieldDescriptor;
import com.oracle.truffle.js.builtins.JSBuiltinsContainer.Switch;
import com.google.protobuf.GeneratedMessageV3;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.ListIterator;
import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.RequestEvent;
import javax.sip.SipFactory;
import javax.sip.header.CallIdHeader;
import javax.sip.header.ExtensionHeader;
import javax.sip.header.Header;
import javax.sip.header.HeaderFactory;
import javax.sip.header.ViaHeader;
import javax.sip.message.Message;
import javax.sip.message.Request;
import javax.sip.message.Response;
import gov.nist.javax.sip.header.CSeq;
import gov.nist.javax.sip.header.CallID;
import gov.nist.javax.sip.header.ContentLength;
import gov.nist.javax.sip.header.ExtensionHeaderImpl;
import io.routr.utils.ClassFinder;
import gov.nist.javax.sip.header.Via;
import io.routr.message.SIPMessage.Builder;
import io.routr.message.*;
import io.routr.common.*;
import io.routr.processor.*;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public 
class MessageConverter {
  private final List<NetInterface> externalAddrs;
  private final List<String> localnets;
  private final static Logger LOG = LogManager.getLogger();

  public MessageConverter(List<String> addrs, List<String> localnets) {
    this.externalAddrs = getExternalAddresses(addrs);
    this.localnets = localnets;
  }

  public MessageRequest createMessageRequest(final Message message) {
    String methodStr = null;
    if (message instanceof Request) {
      methodStr =  ((Request)message).getMethod();
    } else if (message instanceof Response){
      methodStr = ((CSeq) ((Response)message).getHeader(CSeq.NAME)).getMethod();
    }

    String callId = ((CallIdHeader) message.getHeader(CallIdHeader.NAME)).getCallId();
    Method method = Method.valueOf(methodStr.toUpperCase());

    return MessageRequest
        .newBuilder()
        .setRef(callId)
        .setMethod(method)
        .setSender(getSender(message))
        .addAllExternalAddrs(this.externalAddrs)
        .addAllLocalnets(this.localnets)
        .setMessage(convertToMessageDTO(message))
        .build();
  }

  static public SIPMessage convertToMessageDTO(final Message message) {
    Builder sipMessageBuilder = SIPMessage.newBuilder();

    if (message instanceof Request) {
      var sipUri = (javax.sip.address.SipURI) ((Request) message).getRequestURI();
      var requestURI = SipURI.newBuilder();
      requestURI.setSecure(false);

      if (sipUri.getUser() != null) {
        requestURI.setUser(sipUri.getUser());
      }

      if (sipUri.getHost() != null) {
        requestURI.setHost(sipUri.getHost());
      }
      
      if (sipUri.getTransportParam() != null) {
        requestURI.setTransportParam(sipUri.getTransportParam());
      } else {
        requestURI.setTransportParam("udp");
      }

      sipMessageBuilder.setRequestUri(requestURI.build());
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
    HeaderFactory headerFactory = SipFactory.getInstance().createHeaderFactory();
    List<Header> headers = new ArrayList<>();

    var vias = message.getViaList().iterator();

    while (vias.hasNext()) {
      io.routr.message.Via via = vias.next();
      var converter = getConverterByHeader(Via.class);
      headers.add(converter.fromDTO(via));
    }

    if (message.getCallId() != null) {
      var converter = getConverterByHeader(CallID.class);
      headers.add(converter.fromDTO(message.getCallId()));
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
}
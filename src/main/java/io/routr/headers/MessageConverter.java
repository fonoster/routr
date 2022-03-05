package io.routr.headers;

import com.google.protobuf.Descriptors.FieldDescriptor;
import com.google.protobuf.GeneratedMessageV3;
import java.util.ListIterator;
import javax.sip.RequestEvent;
import javax.sip.header.Header;
import javax.sip.message.Request;
import gov.nist.javax.sip.header.CallID;
import gov.nist.javax.sip.header.ContentLength;
import gov.nist.javax.sip.header.Via;
import io.routr.MessageRequest;
import io.routr.SIPMessage;
import io.routr.SIPMessage.Builder;
import org.apache.log4j.Logger;

public class MessageConverter {
  public static Logger log = Logger.getLogger(MessageConverter.class.getName());

  static public MessageRequest convertToMessageRequest(final RequestEvent requestEvent) throws Exception {
    throw new Exception("nyi");
  }

  static public SIPMessage convertToRequestDTO(final Request request) {
    Builder sipMessageBuilder = SIPMessage.newBuilder();
    io.routr.Extension.newBuilder();

    // Getting a list of names of all headers present on SIP Message
    ListIterator<String> namesIterator = request.getHeaderNames();

    // Traversing elements
    while (namesIterator.hasNext()) {
      Header header = request.getHeader(namesIterator.next());
      String fieldName = header.getName().toLowerCase().replace("-", "_");
      Converter<Header, GeneratedMessageV3> converter = getConverterByHeader(header);
      ProtoMapping mapping = converter.getClass().getAnnotation(ProtoMapping.class);
      FieldDescriptor descriptor = SIPMessage.getDescriptor().findFieldByName(fieldName);

      System.out.println("headerName = " + header.getName());
      System.out.println("fieldName = " + fieldName);

      // Takes care of headers that might appear more than once
      if (mapping.repeatable()) {
        ListIterator<Header> headers = request.getHeaders(header.getName());
        while(headers.hasNext()) {
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

  // TODO: 
  // 1. Use reflection to get the correct converter
  // 2. If with don't have a converter, we should automatically use the Extension converter
  static private Converter getConverterByHeader(Header header) {
    if (header instanceof CallID) {
      return new CallIDConverter();
    } else if (header instanceof ContentLength) {
      return new ContentLengthConverter();
    } else if (header instanceof Via) {
      return new ViaConverter();
    } 
    return new ExtensionConverter();
  }
}
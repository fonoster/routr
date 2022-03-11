package io.routr.headers;

import java.text.ParseException;
import java.util.List;
import java.util.ListIterator;
import javax.sip.header.ExtensionHeader;
import javax.sip.header.Header;
import javax.sip.header.HeaderFactory;
import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;

@ProtoMapping(header = ExtensionHeader.class, field = "extensions", repeatable = false, extension = true)
public class ExtensionConverter implements Converter<Header, io.routr.message.Extension> {
  @Override
  public io.routr.message.Extension fromHeader(Header header) {
    if (header instanceof ExtensionHeader) {
      return io.routr.message.Extension.newBuilder()
          .setName(header.getName())
          .setValue(((ExtensionHeader) header).getValue())
          .build();
    } else {
      return io.routr.message.Extension.newBuilder()
          .setName(header.getName())
          .setValue(header.toString().split(header.getName() + ":")[1].trim())
          .build();
    }
  }

  @Override
  public Header fromDTO(io.routr.message.Extension dto)
      throws InvalidArgumentException, PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    return (Header) factory.createHeader(dto.getName(), dto.getValue());
  }
}

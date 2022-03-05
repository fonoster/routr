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
import gov.nist.javax.sip.header.ContentLength;
import io.routr.Extension;

@ProtoMapping(header = ExtensionHeader.class, field = "extensions", repeatable = false, extension = true)
public class ExtensionConverter implements Converter<Header, io.routr.Extension> {
  @Override
  public io.routr.Extension fromHeader(Header header) {
    if (header instanceof ExtensionHeader) {
      return io.routr.Extension.newBuilder()
          .setName(header.getName())
          .setValue(((ExtensionHeader) header).getValue())
          .build();
    } else {
      return io.routr.Extension.newBuilder()
          .setName(header.getName())
          .setValue(header.toString().split(":")[1].trim())
          .build();
    }
  }

  @Override
  public ExtensionHeader fromDTO(io.routr.Extension dto)
      throws InvalidArgumentException, PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    return (ExtensionHeader) factory.createHeader(dto.getName(), dto.getValue());
  }
}

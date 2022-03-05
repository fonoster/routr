package io.routr.headers;

import java.text.ParseException;
import java.util.List;
import java.util.ListIterator;

import javax.sip.header.HeaderFactory;
import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import gov.nist.javax.sip.header.ContentLength;

@ProtoMapping(header = ContentLength.class, field = "content_length", repeatable = false, extension = false)
public class ContentLengthConverter implements Converter<ContentLength, io.routr.ContentLength> {
  @Override
  public io.routr.ContentLength fromHeader(ContentLength header) {
    return io.routr.ContentLength.newBuilder().setContentLength(header.getContentLength()).build();
  }

  @Override
  public ContentLength fromDTO(io.routr.ContentLength dto)
      throws InvalidArgumentException, PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    return (ContentLength) factory.createContentLengthHeader(dto.getContentLength());
  }
}

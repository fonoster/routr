package io.routr.headers;

import java.text.ParseException;
import javax.sip.header.HeaderFactory;
import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import gov.nist.javax.sip.header.Expires;

@ProtoMapping(header = Expires.class, field = "expires", repeatable = false, extension = false)
public class ExpiresConverter implements Converter<Expires, io.routr.message.Expires> {
  @Override
  public io.routr.message.Expires fromHeader(Expires header) {
    return io.routr.message.Expires.newBuilder().setExpires(header.getExpires()).build();
  }

  @Override
  public Expires fromDTO(io.routr.message.Expires dto) throws PeerUnavailableException, ParseException, InvalidArgumentException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    return (Expires) factory.createExpiresHeader(dto.getExpires());
  }
}

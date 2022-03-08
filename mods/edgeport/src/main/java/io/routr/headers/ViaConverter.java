package io.routr.headers;

import java.text.ParseException;
import javax.sip.header.HeaderFactory;
import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import gov.nist.javax.sip.header.Via;

@ProtoMapping(header = Via.class, field = "via", repeatable = true, extension = false)
public class ViaConverter implements Converter<Via, io.routr.Via> {

  @Override
  public io.routr.Via fromHeader(Via header) {
    return io.routr.Via.newBuilder().setHost(header.getHost()).build();
  }

  @Override
  public Via fromDTO(io.routr.Via dto) throws InvalidArgumentException, PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    return (Via) factory.createViaHeader(dto.getHost(), 5060, "", null);
  }
}

package io.routr.headers;

import java.text.ParseException;
import javax.sip.header.HeaderFactory;
import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import gov.nist.javax.sip.header.MaxForwards;

@ProtoMapping(header = MaxForwards.class, field = "max_forwards", repeatable = false, extension = false)
public class MaxForwardsConverter implements Converter<MaxForwards, io.routr.message.MaxForwards> {
  @Override
  public io.routr.message.MaxForwards fromHeader(MaxForwards header) {
    return io.routr.message.MaxForwards.newBuilder().setMaxForwards(header.getMaxForwards()).build();
  }

  @Override
  public MaxForwards fromDTO(io.routr.message.MaxForwards dto) throws PeerUnavailableException, 
    ParseException, InvalidArgumentException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    return (MaxForwards) factory.createMaxForwardsHeader(dto.getMaxForwards());
  }
}

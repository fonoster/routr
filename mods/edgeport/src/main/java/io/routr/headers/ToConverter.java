package io.routr.headers;

import java.text.ParseException;
import javax.sip.header.HeaderFactory;
import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import gov.nist.javax.sip.header.To;

@ProtoMapping(header = To.class, field = "to", repeatable = false, extension = false)
public class ToConverter implements Converter<To, io.routr.message.To> {
  @Override
  public io.routr.message.To fromHeader(To header) {
    var builder = io.routr.message.To.newBuilder();
    var addressConverter = new AddressConverter();
    if (header.getTag() != null) builder.setTag(header.getTag());
    return builder.setAddress(addressConverter.fromObject(header.getAddress())).build();
  }

  @Override
  public To fromDTO(io.routr.message.To dto) throws InvalidArgumentException, PeerUnavailableException, ParseException {
    var addressConverter = new AddressConverter();
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    String tag = dto.getTag().isEmpty() ? null : dto.getTag();
    return (To) factory.createToHeader(addressConverter.fromDTO(dto.getAddress()), tag);
  }
}

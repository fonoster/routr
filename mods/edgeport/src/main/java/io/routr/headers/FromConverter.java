package io.routr.headers;

import java.text.ParseException;
import java.util.Iterator;

import javax.sip.header.HeaderFactory;
import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import gov.nist.javax.sip.header.From;

@ProtoMapping(header = From.class, field = "from", repeatable = false, extension = false)
public class FromConverter implements Converter<From, io.routr.message.From> {
  @Override
  public io.routr.message.From fromHeader(From header) {
    var builder = io.routr.message.From.newBuilder();
    var addressConverter = new AddressConverter();
    Iterator<String> i = header.getParameterNames();
    while (i.hasNext()) {
      String key = (String) i.next();
      builder.putParameters(key, header.getParameter(key));
    }
    if (header.getTag() != null)
      builder.setTag(header.getTag());
    return builder.setAddress(addressConverter.fromObject(header.getAddress())).build();
  }

  @Override
  public From fromDTO(io.routr.message.From dto)
      throws InvalidArgumentException, PeerUnavailableException, ParseException {
    var addressConverter = new AddressConverter();
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    Iterator<String> i = dto.getParametersMap().keySet().iterator();

    if (dto.getTag().isEmpty()) {
      throw new InvalidArgumentException("the From header must contain the tag parameter");
    }

    From from = (From) factory.createFromHeader(addressConverter.fromDTO(dto.getAddress()), dto.getTag());

    while (i.hasNext()) {
      String key = (String) i.next();
      from.setParameter(key, dto.getParametersMap().get(key));
    }
    return from;
  }
}

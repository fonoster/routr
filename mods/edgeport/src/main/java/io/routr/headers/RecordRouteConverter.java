package io.routr.headers;

import java.text.ParseException;
import java.util.Iterator;

import javax.sip.header.HeaderFactory;
import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import gov.nist.javax.sip.header.RecordRoute;

@ProtoMapping(header = RecordRoute.class, field = "record_route", repeatable = true, extension = false)
public class RecordRouteConverter implements Converter<RecordRoute, io.routr.message.RecordRoute> {
  @Override
  public io.routr.message.RecordRoute fromHeader(RecordRoute header) {
    var builder = io.routr.message.RecordRoute.newBuilder();
    var addressConverter = new AddressConverter();
    Iterator<String> i = header.getParameterNames();
    while (i.hasNext()) {
      String key = (String) i.next();
      builder.putParameters(key, header.getParameter(key));
    }
    return builder.setAddress(addressConverter.fromObject(header.getAddress())).build();
  }

  @Override
  public RecordRoute fromDTO(io.routr.message.RecordRoute dto) throws InvalidArgumentException, PeerUnavailableException, ParseException {
    var addressConverter = new AddressConverter();
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    RecordRoute recordRoute = (RecordRoute) factory.createRecordRouteHeader(addressConverter.fromDTO(dto.getAddress()));
    Iterator<String> i = dto.getParametersMap().keySet().iterator();
    while (i.hasNext()) {
      String key = (String) i.next();
      recordRoute.setParameter(key,  dto.getParametersMap().get(key));
    }
    return recordRoute;
  }
}

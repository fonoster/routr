package io.routr.headers;

import java.text.ParseException;
import java.util.Iterator;

import javax.sip.header.HeaderFactory;
import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import gov.nist.javax.sip.header.Route;

@ProtoMapping(header = Route.class, field = "route", repeatable = true, extension = false)
public class RouteConverter implements Converter<Route, io.routr.message.Route> {
  @Override
  public io.routr.message.Route fromHeader(Route header) {
    var builder = io.routr.message.Route.newBuilder();
    var addressConverter = new AddressConverter();
    Iterator<String> i = header.getParameterNames();
    while (i.hasNext()) {
      String key = (String) i.next();
      builder.putParameters(key, header.getParameter(key));
    }
    return builder.setAddress(addressConverter.fromObject(header.getAddress())).build();
  }

  @Override
  public Route fromDTO(io.routr.message.Route dto) throws InvalidArgumentException, PeerUnavailableException, ParseException {
    var addressConverter = new AddressConverter();
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    Route route = (Route) factory.createRouteHeader(addressConverter.fromDTO(dto.getAddress()));
    Iterator<String> i = dto.getParametersMap().keySet().iterator();
    while (i.hasNext()) {
      String key = (String) i.next();
      route.setParameter(key,  dto.getParametersMap().get(key));
    }
    return route;
  }
}
